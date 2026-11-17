import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildQuery, findPharmacies, parseOverpass, SEARCH_RADII_M, type OverpassResponse } from './overpass'

const origin = { lat: 60.1699, lon: 24.9384 }

// Trimmed from a real Overpass response around Helsinki city centre.
const response: OverpassResponse = {
  elements: [
    {
      type: 'node',
      id: 1227011882,
      lat: 60.1683525,
      lon: 24.930792,
      tags: {
        'addr:city': 'Helsinki',
        'addr:housenumber': '2',
        'addr:postcode': '00100',
        'addr:street': 'Kampinkuja',
        amenity: 'pharmacy',
        name: 'Töölön apteekki',
        opening_hours: 'Mo-Fr 08:00-21:00; Sa 10:00-18:00; Su 12:00-18:00',
      },
    },
    {
      type: 'node',
      id: 1369465698,
      lat: 60.1695749,
      lon: 24.939536,
      tags: {
        'addr:city': 'Helsinki',
        'addr:housenumber': '5',
        'addr:postcode': '00100',
        'addr:street': 'Mannerheimintie',
        amenity: 'pharmacy',
        name: 'Yliopiston apteekki',
        opening_hours: '08:00-24:00',
      },
    },
    { type: 'way', id: 42, center: { lat: 60.175, lon: 24.94 }, tags: { amenity: 'pharmacy', brand: 'Apteekki' } },
    { type: 'relation', id: 7, tags: { amenity: 'pharmacy', name: 'No coordinates' } },
  ],
}

describe('parseOverpass', () => {
  const pharmacies = parseOverpass(response, origin)

  it('sorts by distance, nearest first', () => {
    expect(pharmacies.map((p) => p.name)).toEqual(['Yliopiston apteekki', 'Töölön apteekki', 'Apteekki'])
    expect(pharmacies[0].distance).toBeLessThan(pharmacies[1].distance)
  })

  it('maps tags to address and opening hours', () => {
    expect(pharmacies[0]).toMatchObject({
      id: 'node/1369465698',
      address: 'Mannerheimintie 5, 00100 Helsinki',
      openingHours: '08:00-24:00',
    })
  })

  it('uses the centre of ways and falls back to brand for the name', () => {
    expect(pharmacies[2]).toMatchObject({ id: 'way/42', lat: 60.175, lon: 24.94, name: 'Apteekki' })
    expect(pharmacies[2].address).toBeUndefined()
    expect(pharmacies[2].openingHours).toBeUndefined()
  })

  it('skips elements without coordinates', () => {
    expect(pharmacies.find((p) => p.id === 'relation/7')).toBeUndefined()
  })

  it('handles an empty response', () => {
    expect(parseOverpass({ elements: [] }, origin)).toEqual([])
  })
})

describe('buildQuery', () => {
  it('searches nodes, ways and relations around the origin', () => {
    expect(buildQuery(origin, 3000)).toContain('nwr["amenity"="pharmacy"](around:3000,60.1699,24.9384)')
  })
})

describe('findPharmacies', () => {
  afterEach(() => vi.unstubAllGlobals())

  const jsonResponse = (body: OverpassResponse) => new Response(JSON.stringify(body), { status: 200 })

  it('widens the radius until something is found', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ elements: [] }))
      .mockResolvedValueOnce(jsonResponse(response))
    vi.stubGlobal('fetch', fetchMock)

    const result = await findPharmacies(origin)

    expect(result).toHaveLength(3)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(String(fetchMock.mock.calls[1][1].body)).toContain(`around%3A${SEARCH_RADII_M[1]}`)
  })

  it('returns an empty list when nothing is found at the largest radius', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ elements: [] })))
    expect(await findPharmacies(origin)).toEqual([])
  })

  it('falls back to the mirror when the main instance fails', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('busy', { status: 504 }))
      .mockResolvedValueOnce(jsonResponse(response))
    vi.stubGlobal('fetch', fetchMock)

    expect(await findPharmacies(origin)).toHaveLength(3)
    expect(fetchMock.mock.calls[1][0]).not.toBe(fetchMock.mock.calls[0][0])
  })

  it('throws when every endpoint fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('busy', { status: 429 })))
    await expect(findPharmacies(origin)).rejects.toThrow('Overpass returned 429')
  })
})
