/**
 * Tiny equirectangular projection for offline location maps.
 * Pure math — no tiles, no DOM. Land outlines come from campaignLand.ts
 * (Natural Earth 10m, public domain).
 */

export type GeoPoint = {
  lat: number
  lon: number
}

/** Lon/lat box in degrees (west < east, south < north). */
export type MapBounds = {
  west: number
  east: number
  south: number
  north: number
}

/**
 * Default frame for Alexander’s march: Adriatic → Indus, Egypt → Black Sea.
 * Slightly padded so coastal markers aren’t clipped.
 */
export const CAMPAIGN_BOUNDS: MapBounds = {
  west: -5,
  east: 78,
  south: 12,
  north: 46,
}

export type ProjectedPoint = {
  x: number
  y: number
}

/** Project lat/lon into SVG/viewBox pixel space (y grows downward). */
export function projectEquirectangular(
  point: GeoPoint,
  bounds: MapBounds,
  width: number,
  height: number,
): ProjectedPoint {
  const lonSpan = bounds.east - bounds.west
  const latSpan = bounds.north - bounds.south
  if (lonSpan <= 0 || latSpan <= 0 || width <= 0 || height <= 0) {
    return { x: 0, y: 0 }
  }
  const x = ((point.lon - bounds.west) / lonSpan) * width
  const y = ((bounds.north - point.lat) / latSpan) * height
  return { x, y }
}

/**
 * ViewBox size that keeps lon/lat degrees square (no stretch).
 * `maxWidth` caps the SVG; height follows the geographic aspect.
 */
export function mapViewSize(
  bounds: MapBounds,
  maxWidth: number,
  maxHeight: number,
): { w: number; h: number } {
  const lonSpan = Math.max(1e-6, bounds.east - bounds.west)
  const latSpan = Math.max(1e-6, bounds.north - bounds.south)
  const aspect = lonSpan / latSpan
  let w = maxWidth
  let h = w / aspect
  if (h > maxHeight) {
    h = maxHeight
    w = h * aspect
  }
  return { w: Math.round(w), h: Math.round(h) }
}

/** Build an SVG path `d` for a lon/lat ring (closed or open). */
export function ringToSvgPath(
  ring: readonly (readonly [number, number])[],
  bounds: MapBounds,
  width: number,
  height: number,
): string {
  if (ring.length < 2) return ''
  const parts: string[] = []
  for (let i = 0; i < ring.length; i++) {
    const [lon, lat] = ring[i]!
    const { x, y } = projectEquirectangular({ lon, lat }, bounds, width, height)
    const px = Math.round(x * 10) / 10
    const py = Math.round(y * 10) / 10
    parts.push(`${i === 0 ? 'M' : 'L'}${px} ${py}`)
  }
  parts.push('Z')
  return parts.join('')
}

/** True when lat/lon are finite numbers in a plausible geographic range. */
export function isValidGeoPoint(point: GeoPoint): boolean {
  return (
    Number.isFinite(point.lat) &&
    Number.isFinite(point.lon) &&
    point.lat >= -90 &&
    point.lat <= 90 &&
    point.lon >= -180 &&
    point.lon <= 180
  )
}
