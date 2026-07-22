import { CAMPAIGN_LAND_RINGS } from '../lib/campaignLand'
import {
  CAMPAIGN_BOUNDS,
  mapViewSize,
  projectEquirectangular,
  ringToSvgPath,
  type GeoPoint,
  type MapBounds,
} from '../lib/geoMap'
import {
  journeyPathD,
  type VisitKind,
} from '../lib/journeyMap'
import './LocationMap.css'

type Marker = GeoPoint & {
  id: string
  active?: boolean
  /** Named mention vs visit — visits get kind icons on the expanded map. */
  presence?: 'named' | 'visited'
  visitKind?: VisitKind
  visitOrder?: number
}

type Props = {
  /** Focused place — drawn as the primary pin / active icon. */
  focus: GeoPoint & {
    id?: string
    presence?: 'named' | 'visited'
    visitKind?: VisitKind
  }
  /** Optional other places when the map is expanded. */
  others?: readonly Marker[]
  /** Ordered journey stops (visited only) — path + icons when expanded. */
  journey?: readonly Marker[]
  /** Expand taller map with peer markers / journey; compact otherwise. */
  expanded: boolean
  bounds?: MapBounds
  label: string
}

/** Tiny SVG glyphs centered at (0,0); scale ~10×10. */
function VisitIcon({ kind }: { kind: VisitKind }) {
  switch (kind) {
    case 'battle':
      // Crossed swords
      return (
        <g className="loc-map-icon-battle" aria-hidden="true">
          <path d="M-3.2,-3.8 L3.2,3.8 M3.2,-3.8 L-3.2,3.8" />
          <path d="M-3.8,-2.6 L-2.2,-4.2 M2.2,-4.2 L3.8,-2.6" />
          <circle cx="0" cy="0" r="0.9" />
        </g>
      )
    case 'crossing':
      // Triple wave
      return (
        <g className="loc-map-icon-crossing" aria-hidden="true">
          <path d="M-4.2,-1.6 Q-2.1,-3.4 0,-1.6 Q2.1,0.2 4.2,-1.6" />
          <path d="M-4.2,0.4 Q-2.1,-1.4 0,0.4 Q2.1,2.2 4.2,0.4" />
          <path d="M-4.2,2.4 Q-2.1,0.6 0,2.4 Q2.1,4.2 4.2,2.4" />
        </g>
      )
    case 'oracle':
      // Small column / flame
      return (
        <g className="loc-map-icon-oracle" aria-hidden="true">
          <path d="M-1.6,3.5 L-1.6,0.2 L1.6,0.2 L1.6,3.5" />
          <path d="M-2.4,3.5 L2.4,3.5" />
          <path d="M-2.2,0.2 L2.2,0.2" />
          <path d="M0,-3.6 Q1.4,-1.8 0,-0.2 Q-1.4,-1.8 0,-3.6" />
        </g>
      )
    case 'camp':
      // Tent
      return (
        <g className="loc-map-icon-camp" aria-hidden="true">
          <path d="M0,-3.8 L4.2,3.4 L-4.2,3.4 Z" />
          <path d="M0,-3.8 L0,3.4" />
        </g>
      )
    case 'foundation':
      // Eight-point star
      return (
        <g className="loc-map-icon-foundation" aria-hidden="true">
          <path d="M0,-4.2 L1.1,-1.1 L4.2,0 L1.1,1.1 L0,4.2 L-1.1,1.1 L-4.2,0 L-1.1,-1.1 Z" />
        </g>
      )
    case 'city':
    default:
      // Gate / tower silhouette
      return (
        <g className="loc-map-icon-city" aria-hidden="true">
          <path d="M-3.4,3.4 L-3.4,-1.2 L-1.6,-1.2 L-1.6,-3.4 L1.6,-3.4 L1.6,-1.2 L3.4,-1.2 L3.4,3.4 Z" />
          <path d="M-1.1,3.4 L-1.1,0.6 L1.1,0.6 L1.1,3.4" />
        </g>
      )
  }
}

/**
 * Offline SVG map: Natural Earth land silhouette + pin / journey.
 * No tiles, no API keys — calm enough for a reading sheet / PWA.
 */
export function LocationMap({
  focus,
  others = [],
  journey = [],
  expanded,
  bounds = CAMPAIGN_BOUNDS,
  label,
}: Props) {
  const { w, h } = mapViewSize(
    bounds,
    expanded ? 380 : 320,
    expanded ? 280 : 130,
  )
  const pin = projectEquirectangular(focus, bounds, w, h)
  const landPaths = CAMPAIGN_LAND_RINGS.map((ring, i) => ({
    key: `land-${i}`,
    d: ringToSvgPath(ring, bounds, w, h),
  })).filter((p) => p.d.length > 0)

  const journeyProjected = expanded
    ? journey.map((m) => ({
        ...m,
        ...projectEquirectangular(m, bounds, w, h),
      }))
    : []

  const pathD = journeyPathD(
    journeyProjected.map((p) => ({ x: p.x, y: p.y })),
  )

  const journeyIds = new Set(journey.map((m) => m.id))

  const namedPeers = expanded
    ? others
        .filter((m) => !m.active && !journeyIds.has(m.id))
        .map((m) => ({
          id: m.id,
          ...projectEquirectangular(m, bounds, w, h),
        }))
    : []

  const focusKind =
    focus.presence === 'visited' ? (focus.visitKind ?? 'city') : null

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
      {pathD ? (
        <path className="loc-map-journey" d={pathD} fill="none" />
      ) : null}
      {namedPeers.map((p) => (
        <circle
          key={p.id}
          className="loc-map-peer"
          cx={p.x}
          cy={p.y}
          r={2.2}
        />
      ))}
      {journeyProjected.map((p) => (
        <g
          key={`j-${p.id}-${p.visitOrder ?? 0}`}
          className={
            p.active ? 'loc-map-stop loc-map-stop-active' : 'loc-map-stop'
          }
          transform={`translate(${p.x} ${p.y})`}
        >
          <circle className="loc-map-stop-halo" r={7} />
          <VisitIcon kind={p.visitKind ?? 'city'} />
        </g>
      ))}
      {/* Compact (or named-only focus): classic pin when not drawn as a journey stop. */}
      {!expanded || focus.presence !== 'visited' ? (
        <>
          <circle className="loc-map-pin-halo" cx={pin.x} cy={pin.y} r={7} />
          {focusKind ? (
            <g
              className="loc-map-stop loc-map-stop-active"
              transform={`translate(${pin.x} ${pin.y})`}
            >
              <VisitIcon kind={focusKind} />
            </g>
          ) : (
            <circle className="loc-map-pin" cx={pin.x} cy={pin.y} r={3.5} />
          )}
        </>
      ) : null}
    </svg>
  )
}
