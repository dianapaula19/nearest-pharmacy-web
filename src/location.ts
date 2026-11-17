import type { LatLon } from './geo'

export interface Place extends LatLon {
  label: string
}

export class LocationError extends Error {}

const GEOLOCATION_MESSAGES: Record<number, string> = {
  1: 'Location access is turned off. Enter an address or city instead.',
  2: "Your location couldn't be determined. Enter an address or city instead.",
  3: 'Finding your location took too long. Enter an address or city instead.',
}

export function getCurrentPosition(): Promise<Place> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new LocationError("This browser can't share your location. Enter an address or city instead."))
      return
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ lat: coords.latitude, lon: coords.longitude, label: 'your location' }),
      (error) => reject(new LocationError(GEOLOCATION_MESSAGES[error.code] ?? GEOLOCATION_MESSAGES[2])),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    )
  })
}

/** Geocodes a free-text address with Nominatim. Called once per form submit, never per keystroke. */
export async function geocode(query: string, signal?: AbortSignal): Promise<Place> {
  const url = new URL('https://nominatim.openstreetmap.org/search')
  url.search = new URLSearchParams({ q: query, format: 'jsonv2', limit: '1' }).toString()
  const res = await fetch(url, { signal, headers: { 'Accept-Language': navigator.language } })
  if (!res.ok) throw new Error(`Nominatim returned ${res.status}`)
  const [hit] = (await res.json()) as { lat: string; lon: string }[]
  if (!hit) throw new LocationError(`Couldn't find “${query}”. Try a street address or city name.`)
  return { lat: Number(hit.lat), lon: Number(hit.lon), label: query }
}
