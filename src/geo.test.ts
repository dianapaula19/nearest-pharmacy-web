import { describe, expect, it } from 'vitest'
import { distanceMeters, formatDistance, sortByDistance } from './geo'

const helsinkiCathedral = { lat: 60.170278, lon: 24.952222 }
const turkuCathedral = { lat: 60.452222, lon: 22.278333 }

describe('distanceMeters', () => {
  it('is zero for the same point', () => {
    expect(distanceMeters(helsinkiCathedral, helsinkiCathedral)).toBe(0)
  })

  it('matches the known Helsinki–Turku distance (~150 km)', () => {
    expect(distanceMeters(helsinkiCathedral, turkuCathedral) / 1000).toBeCloseTo(150.5, 0)
  })

  it('is symmetric', () => {
    expect(distanceMeters(helsinkiCathedral, turkuCathedral)).toBeCloseTo(
      distanceMeters(turkuCathedral, helsinkiCathedral),
    )
  })

  it('handles the antimeridian', () => {
    const d = distanceMeters({ lat: 0, lon: 179.999 }, { lat: 0, lon: -179.999 })
    expect(d).toBeLessThan(300)
  })
})

describe('sortByDistance', () => {
  it('sorts nearest first and attaches distances without mutating input', () => {
    const places = [
      { id: 'far', lat: 60.2, lon: 24.95 },
      { id: 'near', lat: 60.171, lon: 24.952 },
      { id: 'mid', lat: 60.18, lon: 24.95 },
    ]
    const sorted = sortByDistance(helsinkiCathedral, places)
    expect(sorted.map((p) => p.id)).toEqual(['near', 'mid', 'far'])
    expect(sorted[0].distance).toBeGreaterThan(0)
    expect(sorted[0].distance).toBeLessThan(sorted[1].distance)
    expect(places[0].id).toBe('far')
  })

  it('returns an empty array for no places', () => {
    expect(sortByDistance(helsinkiCathedral, [])).toEqual([])
  })
})

describe('formatDistance', () => {
  it.each([
    [42, '40 m'],
    [995, '1.0 km'],
    [1234, '1.2 km'],
    [15_400, '15 km'],
  ])('%d m → %s', (m, expected) => {
    expect(formatDistance(m)).toBe(expected)
  })
})
