import { type LatLon, sortByDistance } from './geo'

export interface Pharmacy extends LatLon {
  id: string
  name: string
  address?: string
  openingHours?: string
}

export type PharmacyWithDistance = Pharmacy & { distance: number }

interface OverpassElement {
  type: 'node' | 'way' | 'relation'
  id: number
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
  tags?: Record<string, string>
}

export interface OverpassResponse {
  elements: OverpassElement[]
}

// Tried in order: the main instance is often at capacity, so fall back to a mirror.
const ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter']
const REQUEST_TIMEOUT_MS = 30_000

// A pharmacy found within radius r is the true nearest, so widen only when nothing is found.
export const SEARCH_RADII_M = [3_000, 10_000, 30_000]

export function buildQuery({ lat, lon }: LatLon, radius: number): string {
  return `[out:json][timeout:25];nwr["amenity"="pharmacy"](around:${radius},${lat},${lon});out center tags;`
}

function formatAddress(tags: Record<string, string>): string | undefined {
  if (tags['addr:full']) return tags['addr:full']
  const street = [tags['addr:street'], tags['addr:housenumber']].filter(Boolean).join(' ')
  const city = [tags['addr:postcode'], tags['addr:city']].filter(Boolean).join(' ')
  return [street, city].filter(Boolean).join(', ') || undefined
}

/** Turns raw Overpass elements into pharmacies sorted by distance from `origin`. */
export function parseOverpass(response: OverpassResponse, origin: LatLon): PharmacyWithDistance[] {
  const pharmacies: Pharmacy[] = []
  for (const el of response.elements) {
    const lat = el.lat ?? el.center?.lat
    const lon = el.lon ?? el.center?.lon
    if (lat === undefined || lon === undefined) continue
    const tags = el.tags ?? {}
    pharmacies.push({
      id: `${el.type}/${el.id}`,
      lat,
      lon,
      name: tags.name ?? tags.brand ?? 'Pharmacy',
      address: formatAddress(tags),
      openingHours: tags.opening_hours,
    })
  }
  return sortByDistance(origin, pharmacies)
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => {
      clearTimeout(timer)
      reject(signal.reason)
    }, { once: true })
  })

// The public instances often answer 429/504 when busy and ask clients to back off exponentially.
const RETRY_DELAYS_MS = [1_000, 2_000]

async function query(body: string, signal?: AbortSignal): Promise<OverpassResponse> {
  let lastError: unknown
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    if (attempt > 0) await sleep(RETRY_DELAYS_MS[attempt - 1], signal)
    for (const endpoint of ENDPOINTS) {
      const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS)
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ data: body }),
          signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
        })
        if (res.ok) return (await res.json()) as OverpassResponse
        lastError = new Error(`Overpass returned ${res.status}`)
      } catch (error) {
        if (signal?.aborted) throw error
        lastError = error
      }
    }
  }
  throw lastError
}

/** Searches outward in growing radii until at least one pharmacy is found. */
export async function findPharmacies(origin: LatLon, signal?: AbortSignal): Promise<PharmacyWithDistance[]> {
  for (const radius of SEARCH_RADII_M) {
    const results = parseOverpass(await query(buildQuery(origin, radius), signal), origin)
    if (results.length > 0) return results
  }
  return []
}
