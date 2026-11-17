import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useRef } from 'react'
import type { LatLon } from './geo'
import type { PharmacyWithDistance } from './overpass'

interface Props {
  origin: LatLon
  pharmacies: PharmacyWithDistance[]
}

export function PharmacyMap({ origin, pharmacies }: Props) {
  const container = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const map = L.map(container.current!, { scrollWheelZoom: false })
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map)

    // Circle markers avoid Leaflet's default icon images, which need extra bundler config.
    L.circleMarker([origin.lat, origin.lon], { radius: 8, className: 'marker-user' })
      .bindTooltip('You are here')
      .addTo(map)
    pharmacies.forEach((p, i) => {
      L.circleMarker([p.lat, p.lon], { radius: i === 0 ? 10 : 7, className: i === 0 ? 'marker-nearest' : 'marker' })
        .bindTooltip(p.name)
        .addTo(map)
    })

    const bounds = L.latLngBounds([[origin.lat, origin.lon], ...pharmacies.map((p): [number, number] => [p.lat, p.lon])])
    map.fitBounds(bounds, { padding: [24, 24], maxZoom: 16 })

    return () => {
      map.remove()
    }
  }, [origin, pharmacies])

  return <div ref={container} className="map" role="region" aria-label="Map of nearby pharmacies" />
}
