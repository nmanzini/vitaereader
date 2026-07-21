import {
  CAMPAIGN_BOUNDS,
  projectEquirectangular,
  type GeoPoint,
  type MapBounds,
} from '../lib/geoMap'
import './LocationMap.css'

type Marker = GeoPoint & {
  id: string
  active?: boolean
}

type Props = {
  /** Focused place — drawn as the primary pin. */
  focus: GeoPoint
  /** Optional other places (muted dots) when the map is expanded. */
  others?: readonly Marker[]
  /** Expand taller map with peer markers; compact otherwise. */
  expanded: boolean
  bounds?: MapBounds
  label: string
}

const COMPACT = { w: 320, h: 120 }
const EXPANDED = { w: 320, h: 200 }

/**
 * Offline SVG sketch-map: equirectangular frame + pin.
 * No tiles — calm enough for a reading sheet.
 */
export function LocationMap({
  focus,
  others = [],
  expanded,
  bounds = CAMPAIGN_BOUNDS,
  label,
}: Props) {
  const { w, h } = expanded ? EXPANDED : COMPACT
  const pin = projectEquirectangular(focus, bounds, w, h)
  const peers = expanded
    ? others
        .filter((m) => !m.active)
        .map((m) => ({
          id: m.id,
          ...projectEquirectangular(m, bounds, w, h),
        }))
    : []

  return (
    <svg
      className={expanded ? 'loc-map loc-map-expanded' : 'loc-map'}
      viewBox={`0 0 ${w} ${h}`}
      role="img"
      aria-label={label}
    >
      <rect className="loc-map-sea" x="0" y="0" width={w} height={h} />
      {/* Soft “land band” suggestion — not a real coast, just atmosphere. */}
      <ellipse
        className="loc-map-land"
        cx={w * 0.48}
        cy={h * 0.55}
        rx={w * 0.42}
        ry={h * 0.38}
      />
      {peers.map((p) => (
        <circle
          key={p.id}
          className="loc-map-peer"
          cx={p.x}
          cy={p.y}
          r={2.2}
        />
      ))}
      <circle className="loc-map-pin-halo" cx={pin.x} cy={pin.y} r={7} />
      <circle className="loc-map-pin" cx={pin.x} cy={pin.y} r={3.5} />
    </svg>
  )
}
