/**
 * Protagonist journey helpers for location annotations.
 * Places are either named in the text or visited by the subject;
 * visits (ordered + typed) draw the expanded-map path and icons.
 */

import type { LocationAnnotation } from './charMatch.ts'
import {
  CAMPAIGN_BOUNDS,
  type GeoPoint,
  type MapBounds,
} from './geoMap.ts'

/** Why a place is annotated in the work. Default when omitted: named. */
export type LocationPresence = 'named' | 'visited'

/** Icon / meaning for a protagonist visit stop. */
export const VISIT_KINDS = [
  'city',
  'battle',
  'crossing',
  'oracle',
  'camp',
  'foundation',
] as const

export type VisitKind = (typeof VISIT_KINDS)[number]

export type JourneyStop = {
  id: string
  lat: number
  lon: number
  kind: VisitKind
  order: number
  /** Canonical display name (first surface form). */
  name: string
}

export function isVisitKind(value: unknown): value is VisitKind {
  return (
    typeof value === 'string' &&
    (VISIT_KINDS as readonly string[]).includes(value)
  )
}

/** Resolve presence; missing field → named (mention-only). */
export function locationPresence(
  loc: Pick<LocationAnnotation, 'presence'> | null | undefined,
): LocationPresence {
  return loc?.presence === 'visited' ? 'visited' : 'named'
}

/** Default icon when a visit omits visitKind. */
export function visitKindOf(
  loc: Pick<LocationAnnotation, 'visitKind'> | null | undefined,
): VisitKind {
  return isVisitKind(loc?.visitKind) ? loc.visitKind : 'city'
}

/**
 * Visited places in chronological order for the campaign path.
 * Requires presence=visited and a finite visitOrder.
 */
export function journeyStops(
  locations: readonly LocationAnnotation[],
): JourneyStop[] {
  const stops: JourneyStop[] = []
  for (const loc of locations) {
    if (locationPresence(loc) !== 'visited') continue
    if (!Number.isFinite(loc.visitOrder)) continue
    stops.push({
      id: loc.id,
      lat: loc.lat,
      lon: loc.lon,
      kind: visitKindOf(loc),
      order: loc.visitOrder as number,
      name: loc.names[0] ?? loc.id,
    })
  }
  stops.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
  return stops
}

/** SVG path `d` through projected points (open polyline). */
export function journeyPathD(
  points: readonly { x: number; y: number }[],
): string {
  if (points.length < 2) return ''
  const parts: string[] = []
  for (let i = 0; i < points.length; i++) {
    const p = points[i]!
    const x = Math.round(p.x * 10) / 10
    const y = Math.round(p.y * 10) / 10
    parts.push(`${i === 0 ? 'M' : 'L'}${x} ${y}`)
  }
  return parts.join('')
}

/**
 * Lon/lat box tightly around points with padding (degrees).
 * Falls back to the Alexander campaign frame when empty.
 */
export function boundsForPoints(
  points: readonly GeoPoint[],
  padding = 5,
  fallback: MapBounds = CAMPAIGN_BOUNDS,
): MapBounds {
  if (points.length === 0) return { ...fallback }

  let west = Infinity
  let east = -Infinity
  let south = Infinity
  let north = -Infinity
  for (const p of points) {
    west = Math.min(west, p.lon)
    east = Math.max(east, p.lon)
    south = Math.min(south, p.lat)
    north = Math.max(north, p.lat)
  }

  // Minimum span so a single pin (or tight cluster) still frames as a map.
  const minSpan = 8
  const lonSpan = east - west
  const latSpan = north - south
  if (lonSpan < minSpan) {
    const mid = (west + east) / 2
    west = mid - minSpan / 2
    east = mid + minSpan / 2
  }
  if (latSpan < minSpan) {
    const mid = (south + north) / 2
    south = mid - minSpan / 2
    north = mid + minSpan / 2
  }

  west -= padding
  east += padding
  south -= padding
  north += padding

  west = Math.max(-180, west)
  east = Math.min(180, east)
  south = Math.max(-90, south)
  north = Math.min(90, north)

  if (east <= west || north <= south) return { ...fallback }
  return { west, east, south, north }
}
