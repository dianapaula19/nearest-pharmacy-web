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
const ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter']

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

async function query(body: string, signal?: AbortSignal): Promise<OverpassResponse> {
  let lastError: unknown
  for (const endpoint of ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ data: body }),
        signal,
      })
      if (res.ok) return (await res.json()) as OverpassResponse
      lastError = new Error(`Overpass returned ${res.status}`)
    } catch (error) {
      if (signal?.aborted) throw error
      lastError = error
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
