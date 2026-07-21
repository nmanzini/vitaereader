import { useEffect, useId, useState } from 'react'
import {
  segmentAnnotationText,
  type LocationAnnotation,
} from '../lib/charMatch'
import { LocationMap } from './LocationMap'
import './LocationSheet.css'

type Props = {
  open: boolean
  location: LocationAnnotation | null
  subject: string
  /** Full place list for in-blurb hops + peer map dots. */
  locations: readonly LocationAnnotation[]
  onClose: () => void
}

/** Kindle-like place sheet: blurb + optional expandable sketch map. */
export function LocationSheet({
  open,
  location,
  subject,
  locations,
  onClose,
}: Props) {
  const titleId = useId()
  const [viewing, setViewing] = useState<LocationAnnotation | null>(null)
  const [history, setHistory] = useState<LocationAnnotation[]>([])
  const [mapOpen, setMapOpen] = useState(false)

  const openedId = open ? (location?.id ?? null) : null
  useEffect(() => {
    if (openedId == null || !location) {
      setViewing(null)
      setHistory([])
      setMapOpen(false)
      return
    }
    setViewing(location)
    setHistory([])
    setMapOpen(false)
  }, [openedId, location])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open || !viewing) return null

  const current = viewing
  const name = current.names[0] ?? current.id
  const others = locations.filter((l) => l.id !== current.id)
  const blurbSegments = segmentAnnotationText(current.blurb, [], others)
  const peerMarkers = locations.map((l) => ({
    id: l.id,
    lat: l.lat,
    lon: l.lon,
    active: l.id === current.id,
  }))

  function openLocation(locationId: string) {
    const next = locations.find((l) => l.id === locationId)
    if (!next || next.id === current.id) return
    setHistory((h) => [...h, current])
    setViewing(next)
  }

  function goBack() {
    setHistory((h) => {
      if (h.length === 0) return h
      const prev = h[h.length - 1]!
      setViewing(prev)
      return h.slice(0, -1)
    })
  }

  return (
    <div className="loc-sheet-backdrop" onClick={onClose}>
      <div
        className="loc-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="loc-sheet-header">
          <div className="loc-sheet-title-row">
            {history.length > 0 ? (
              <button
                type="button"
                className="loc-sheet-back"
                onClick={goBack}
                aria-label="Back to previous place"
              >
                Back
              </button>
            ) : null}
            <h2 id={titleId}>{name}</h2>
          </div>
          <button type="button" className="loc-sheet-close" onClick={onClose}>
            Close
          </button>
        </header>
        <p className="loc-sheet-relation">
          {current.relation}
          {subject ? (
            <span className="loc-sheet-subject"> · re {subject}</span>
          ) : null}
        </p>
        {current.modern ? (
          <p className="loc-sheet-modern">Today: {current.modern}</p>
        ) : null}
        <p className="loc-sheet-blurb">
          {blurbSegments.map((seg, i) =>
            seg.type === 'loc' ? (
              <button
                key={`${seg.locationId}:${i}`}
                type="button"
                className="loc-sheet-inline"
                onClick={() => openLocation(seg.locationId)}
              >
                {seg.text}
              </button>
            ) : (
              <span key={`t:${i}`}>{seg.text}</span>
            ),
          )}
        </p>

        <div className="loc-sheet-map-block">
          <button
            type="button"
            className="loc-sheet-map-toggle"
            aria-expanded={mapOpen}
            onClick={() => setMapOpen((v) => !v)}
          >
            {mapOpen ? 'Collapse map' : 'Expand map'}
          </button>
          {mapOpen ? (
            <LocationMap
              focus={{ lat: current.lat, lon: current.lon }}
              others={peerMarkers}
              expanded
              label={`Map showing ${name}`}
            />
          ) : (
            <LocationMap
              focus={{ lat: current.lat, lon: current.lon }}
              expanded={false}
              label={`Map showing ${name}`}
            />
          )}
        </div>
      </div>
    </div>
  )
}
