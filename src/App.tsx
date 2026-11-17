import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import { directionsUrl } from './directions'
import { formatDistance } from './geo'
import { getCurrentPosition, geocode, LocationError, type Place } from './location'
import { findPharmacies, type PharmacyWithDistance } from './overpass'
import { PharmacyMap } from './PharmacyMap'

const LIST_SIZE = 10

type State =
  | { kind: 'locating' }
  | { kind: 'needs-address'; message: string }
  | { kind: 'loading'; origin: Place }
  | { kind: 'ready'; origin: Place; pharmacies: PharmacyWithDistance[] }
  | { kind: 'empty'; origin: Place }
  | { kind: 'error'; message: string; retry: () => void }

function errorMessage(error: unknown): string {
  if (error instanceof LocationError) return error.message
  if (!navigator.onLine) return "You're offline. Check your connection and try again."
  return "Couldn't reach the map service. It may be busy, so try again in a moment."
}

export function App() {
  const [state, setState] = useState<State>({ kind: 'locating' })
  const [address, setAddress] = useState('')
  const inFlight = useRef<AbortController | null>(null)
  const input = useRef<HTMLInputElement>(null)

  // Every search cancels the previous one, so a slow response can never overwrite a newer one.
  const run = useCallback(async (getOrigin: (signal: AbortSignal) => Promise<Place>) => {
    inFlight.current?.abort()
    const controller = new AbortController()
    inFlight.current = controller
    const retry = () => void run(getOrigin)
    let origin: Place | undefined
    try {
      origin = await getOrigin(controller.signal)
      setState({ kind: 'loading', origin })
      const pharmacies = await findPharmacies(origin, controller.signal)
      setState(pharmacies.length ? { kind: 'ready', origin, pharmacies } : { kind: 'empty', origin })
    } catch (error) {
      if (controller.signal.aborted) return
      setState(
        error instanceof LocationError && !origin
          ? { kind: 'needs-address', message: error.message }
          : { kind: 'error', message: errorMessage(error), retry },
      )
    }
  }, [])

  const locate = useCallback(() => {
    setState({ kind: 'locating' })
    void run(() => getCurrentPosition())
  }, [run])

  useEffect(() => {
    locate()
    return () => inFlight.current?.abort()
  }, [locate])

  useEffect(() => {
    if (state.kind === 'needs-address') input.current?.focus()
  }, [state.kind])

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    const query = address.trim()
    if (!query) return
    setState({ kind: 'locating' })
    void run((signal) => geocode(query, signal))
  }

  const busy = state.kind === 'locating' || state.kind === 'loading'

  return (
    <main>
      <header>
        <h1>
          <span aria-hidden="true">💊</span> Nearest pharmacy
        </h1>
        <form className="search" onSubmit={onSubmit} role="search">
          <label htmlFor="address">Address or city</label>
          <div className="search-row">
            <input
              id="address"
              ref={input}
              type="text"
              autoComplete="street-address"
              placeholder="e.g. Mannerheimintie 1, Helsinki"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
            <button type="submit" disabled={busy || !address.trim()}>
              Search
            </button>
          </div>
          <button type="button" className="link" onClick={locate} disabled={busy}>
            Use my current location
          </button>
        </form>
      </header>

      <section aria-live="polite" aria-busy={busy}>
        <Status state={state} />
      </section>
    </main>
  )
}

function Status({ state }: { state: State }) {
  switch (state.kind) {
    case 'locating':
      return <p className="status">Finding your location…</p>
    case 'loading':
      return (
        <div className="status">
          <p>Looking for pharmacies near {state.origin.label}…</p>
          <p className="muted">OpenStreetMap's free search service can take a few seconds.</p>
        </div>
      )
    case 'needs-address':
      return <p className="status">{state.message}</p>
    case 'empty':
      return <p className="status">No pharmacies found within 30 km of {state.origin.label}. Try another address.</p>
    case 'error':
      return (
        <div className="status error" role="alert">
          <p>{state.message}</p>
          <button type="button" onClick={state.retry}>
            Try again
          </button>
        </div>
      )
    case 'ready':
      return <Results origin={state.origin} pharmacies={state.pharmacies.slice(0, LIST_SIZE + 1)} />
  }
}

function Results({ origin, pharmacies }: { origin: Place; pharmacies: PharmacyWithDistance[] }) {
  const [nearest, ...others] = pharmacies
  return (
    <>
      <article className="nearest" aria-labelledby="nearest-name">
        <p className="eyebrow">Nearest to {origin.label}</p>
        <h2 id="nearest-name">{nearest.name}</h2>
        <p className="distance">{formatDistance(nearest.distance)} away</p>
        {nearest.address && <p>{nearest.address}</p>}
        {nearest.openingHours && (
          <p>
            <span className="muted">Hours: </span>
            {nearest.openingHours}
          </p>
        )}
        <a className="button" href={directionsUrl(nearest)} target="_blank" rel="noreferrer">
          Directions
        </a>
      </article>

      <PharmacyMap origin={origin} pharmacies={pharmacies} />

      {others.length > 0 && (
        <>
          <h2 className="list-heading">Also nearby</h2>
          <ol className="list">
            {others.map((p) => (
              <li key={p.id}>
                <div>
                  <strong>{p.name}</strong>
                  {p.address && <span className="muted">{p.address}</span>}
                </div>
                <a href={directionsUrl(p)} target="_blank" rel="noreferrer" aria-label={`Directions to ${p.name}`}>
                  {formatDistance(p.distance)}
                </a>
              </li>
            ))}
          </ol>
        </>
      )}
    </>
  )
}
