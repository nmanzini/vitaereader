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

/** How the leg into this stop was traveled. */
export type TravelMode = 'land' | 'sea'

export type JourneyStop = {
  id: string
  lat: number
  lon: number
  kind: VisitKind
  order: number
  /** Canonical display name (first surface form). */
  name: string
  /** Inbound leg mode from the previous stop (sea → dotted). */
  travel: TravelMode
}

export type JourneyPathSegment = {
  mode: TravelMode
  /** SVG path `d` for one leg (`M…L…`). */
  d: string
}

export function isVisitKind(value: unknown): value is VisitKind {
  return (
    typeof value === 'string' &&
    (VISIT_KINDS as readonly string[]).includes(value)
  )
}

export function isTravelMode(value: unknown): value is TravelMode {
  return value === 'land' || value === 'sea'
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

/** Inbound travel mode; missing → land. */
export function travelModeOf(
  loc: Pick<LocationAnnotation, 'travel'> | null | undefined,
): TravelMode {
  return loc?.travel === 'sea' ? 'sea' : 'land'
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
      travel: travelModeOf(loc),
    })
  }
  stops.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
  return stops
}

/**
 * Journey progress through a story beat: stops with order ≤ throughOrder.
 * Empty when throughOrder is missing (e.g. named-only place).
 */
export function journeyThrough(
  stops: readonly JourneyStop[],
  throughOrder: number | null | undefined,
): JourneyStop[] {
  if (throughOrder == null || !Number.isFinite(throughOrder)) return []
  return stops.filter((s) => s.order <= throughOrder)
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
 * One SVG leg per consecutive stop pair.
 * Mode comes from the destination stop (`travel`).
 */
export function journeyPathSegments(
  stops: readonly Pick<JourneyStop, 'travel'>[],
  points: readonly { x: number; y: number }[],
): JourneyPathSegment[] {
  if (points.length < 2 || stops.length !== points.length) return []
  const segments: JourneyPathSegment[] = []
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!
    const b = points[i]!
    const ax = Math.round(a.x * 10) / 10
    const ay = Math.round(a.y * 10) / 10
    const bx = Math.round(b.x * 10) / 10
    const by = Math.round(b.y * 10) / 10
    segments.push({
      mode: stops[i]!.travel === 'sea' ? 'sea' : 'land',
      d: `M${ax} ${ay}L${bx} ${by}`,
    })
  }
  return segments
}

/**
 * Lon/lat box tightly around points with padding (degrees).
 * Falls back to the Alexander campaign frame when empty.
 */
export function boundsForPoints(
  points: readonly GeoPoint[],
  padding = 5,
  fallback: MapBounds = CAMPAIGN_BOUNDS,
  minSpan = 8,
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

/**
 * Expanded-map frame sized to the route itself: padding scales with the
 * path’s lon/lat span so short journeys stay tight and long ones breathe.
 */
export function boundsForRoute(
  points: readonly GeoPoint[],
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

  const lonSpan = Math.max(0, east - west)
  const latSpan = Math.max(0, north - south)
  const major = Math.max(lonSpan, latSpan)

  // ~16% of route width, clamped — proportional to the path, not a fixed box.
  const pad = Math.min(10, Math.max(1.2, major * 0.16 + 0.8))
  // Tiny routes still need a readable window; large routes don’t get inflated.
  const minSpan = major < 4 ? 6 : Math.min(8, major * 0.25 + 2)

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

  west = Math.max(-180, west - pad)
  east = Math.min(180, east + pad)
  south = Math.max(-90, south - pad)
  north = Math.min(90, north + pad)

  if (east <= west || north <= south) return { ...fallback }
  return { west, east, south, north }
}

/**
 * Collapsed-sheet zoom: a local window centered on one place.
 * `halfSpan` is degrees from center to each edge (~5° ≈ regional).
 */
export function boundsAroundPoint(
  point: GeoPoint,
  halfSpan = 5,
): MapBounds {
  const span = Math.max(1, halfSpan)
  return {
    west: Math.max(-180, point.lon - span),
    east: Math.min(180, point.lon + span),
    south: Math.max(-90, point.lat - span),
    north: Math.min(90, point.lat + span),
  }
}
