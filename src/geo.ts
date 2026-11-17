export interface LatLon {
  lat: number
  lon: number
}

const EARTH_RADIUS_M = 6_371_008.8

const toRad = (deg: number) => (deg * Math.PI) / 180

/** Great-circle distance in metres (haversine). */
export function distanceMeters(a: LatLon, b: LatLon): number {
  const dLat = toRad(b.lat - a.lat)
  const dLon = toRad(b.lon - a.lon)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** Returns a new array with each place's distance from `origin`, nearest first. */
export function sortByDistance<T extends LatLon>(origin: LatLon, places: T[]): (T & { distance: number })[] {
  return places
    .map((p) => ({ ...p, distance: distanceMeters(origin, p) }))
    .sort((a, b) => a.distance - b.distance)
}

export function formatDistance(meters: number): string {
  const rounded = Math.round(meters / 10) * 10
  if (rounded < 1000) return `${rounded} m`
  return `${(meters / 1000).toFixed(meters < 10_000 ? 1 : 0)} km`
}
