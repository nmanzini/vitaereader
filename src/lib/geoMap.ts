/**
 * Tiny equirectangular projection for offline location maps.
 * Pure math — no tiles, no DOM.
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
