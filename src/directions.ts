import type { Pharmacy } from './overpass'

/** Apple Maps on Apple devices, Google Maps elsewhere (opens the app on Android). */
export function directionsUrl({ lat, lon, name }: Pharmacy, userAgent = navigator.userAgent): string {
  if (/iPhone|iPad|Macintosh/.test(userAgent)) {
    return `https://maps.apple.com/?daddr=${lat},${lon}&q=${encodeURIComponent(name)}`
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`
}
