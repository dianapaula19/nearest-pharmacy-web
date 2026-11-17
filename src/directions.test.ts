import { describe, expect, it } from 'vitest'
import { directionsUrl } from './directions'

const pharmacy = { id: 'node/1', name: 'Kluuvin apteekki', lat: 60.1697, lon: 24.9434 }

describe('directionsUrl', () => {
  it('opens Apple Maps on iPhone', () => {
    const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)'
    expect(directionsUrl(pharmacy, ua)).toBe('https://maps.apple.com/?daddr=60.1697,24.9434&q=Kluuvin%20apteekki')
  })

  it('opens Google Maps elsewhere', () => {
    const ua = 'Mozilla/5.0 (Linux; Android 15)'
    expect(directionsUrl(pharmacy, ua)).toBe('https://www.google.com/maps/dir/?api=1&destination=60.1697,24.9434')
  })
})
