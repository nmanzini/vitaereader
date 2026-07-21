import { CAMPAIGN_LAND_RINGS } from '../lib/campaignLand'
import {
  CAMPAIGN_BOUNDS,
  mapViewSize,
  projectEquirectangular,
  ringToSvgPath,
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

/**
 * Offline SVG map: Natural Earth land silhouette + pin.
 * No tiles, no API keys — calm enough for a reading sheet / PWA.
 */
export function LocationMap({
  focus,
  others = [],
  expanded,
  bounds = CAMPAIGN_BOUNDS,
  label,
}: Props) {
  const { w, h } = mapViewSize(
    bounds,
    320,
    expanded ? 210 : 130,
  )
  const pin = projectEquirectangular(focus, bounds, w, h)
  const landPaths = CAMPAIGN_LAND_RINGS.map((ring, i) => ({
    key: `land-${i}`,
    d: ringToSvgPath(ring, bounds, w, h),
  })).filter((p) => p.d.length > 0)

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
      {landPaths.map((p) => (
        <path key={p.key} className="loc-map-land" d={p.d} />
      ))}
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
