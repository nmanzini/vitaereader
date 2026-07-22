#!/usr/bin/env node
/**
 * Rebuild src/lib/campaignLand.ts from Natural Earth 10m land (public domain).
 *
 * Usage:
 *   node scripts/build-campaign-land.mjs /tmp/ne-land/ne_10m_land.geojson
 *
 * Clips to the Vitae campaign frame (Britain → Indus, Egypt → Baltic),
 * simplifies with Douglas–Peucker, keeps recognizable Mediterranean islands.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const src = process.argv[2]
if (!src) {
  console.error('Usage: node scripts/build-campaign-land.mjs <ne_10m_land.geojson>')
  process.exit(1)
}

/** Lon/lat frame covering Alexander + Caesar journeys (with pad). */
const FRAME = { west: -15, east: 80, south: 10, north: 58 }

/**
 * Adaptive simplify: keep Mediterranean / Aegean coasts dense so Greece
 * reads as a peninsula, not a shard; coarsen far coasts to bound file size.
 */
const MED = { west: -9, east: 40, south: 29, north: 47 }
const TOL_MED = 0.012
const TOL_FAR = 0.08

/** Drop tiny islets after simplify. */
const MIN_POINTS = 4
const MIN_AREA = 0.006 // deg² rough shoelace

function ringBBox(ring) {
  let west = Infinity
  let east = -Infinity
  let south = Infinity
  let north = -Infinity
  for (const [lon, lat] of ring) {
    west = Math.min(west, lon)
    east = Math.max(east, lon)
    south = Math.min(south, lat)
    north = Math.max(north, lat)
  }
  return { west, east, south, north }
}

function bboxIntersects(a, b) {
  return !(a.east < b.west || a.west > b.east || a.north < b.south || a.south > b.north)
}

function pointInFrame([lon, lat], f = FRAME) {
  return lon >= f.west && lon <= f.east && lat >= f.south && lat <= f.north
}

function pointInMed([lon, lat]) {
  return (
    lon >= MED.west &&
    lon <= MED.east &&
    lat >= MED.south &&
    lat <= MED.north
  )
}

function toleranceAt(p) {
  return pointInMed(p) ? TOL_MED : TOL_FAR
}

/** Keep rings that touch the frame (any vertex inside, or bbox overlap with points near frame). */
function ringTouchesFrame(ring) {
  if (ring.some((p) => pointInFrame(p))) return true
  return bboxIntersects(ringBBox(ring), FRAME)
}

function perpDist(p, a, b) {
  const [x, y] = p
  const [x1, y1] = a
  const [x2, y2] = b
  const dx = x2 - x1
  const dy = y2 - y1
  if (dx === 0 && dy === 0) {
    const ex = x - x1
    const ey = y - y1
    return Math.hypot(ex, ey)
  }
  const t = ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)
  const px = x1 + t * dx
  const py = y1 + t * dy
  return Math.hypot(x - px, y - py)
}

function douglasPeucker(points) {
  if (points.length <= 2) return points.slice()
  let maxDist = 0
  let idx = 0
  const first = points[0]
  const last = points[points.length - 1]
  for (let i = 1; i < points.length - 1; i++) {
    const d = perpDist(points[i], first, last)
    if (d > maxDist) {
      maxDist = d
      idx = i
    }
  }
  const tol = Math.min(
    toleranceAt(first),
    toleranceAt(last),
    toleranceAt(points[idx]),
  )
  if (maxDist > tol) {
    const left = douglasPeucker(points.slice(0, idx + 1))
    const right = douglasPeucker(points.slice(idx))
    return left.slice(0, -1).concat(right)
  }
  return [first, last]
}

function simplifyClosed(ring) {
  if (ring.length < 4) return ring
  const open =
    ring[0][0] === ring[ring.length - 1][0] &&
    ring[0][1] === ring[ring.length - 1][1]
      ? ring.slice(0, -1)
      : ring.slice()
  const simplified = douglasPeucker(open)
  if (simplified.length < 3) return null
  const first = simplified[0]
  const last = simplified[simplified.length - 1]
  if (first[0] !== last[0] || first[1] !== last[1]) {
    simplified.push([first[0], first[1]])
  }
  return simplified
}

function shoelaceArea(ring) {
  let a = 0
  for (let i = 0; i < ring.length - 1; i++) {
    const [x1, y1] = ring[i]
    const [x2, y2] = ring[i + 1]
    a += x1 * y2 - x2 * y1
  }
  return Math.abs(a) / 2
}

/** 3 decimals in Med (~100m), 2 elsewhere (~1km). */
function roundPoint(p) {
  if (pointInMed(p)) {
    return [
      Math.round(p[0] * 1000) / 1000,
      Math.round(p[1] * 1000) / 1000,
    ]
  }
  return [Math.round(p[0] * 100) / 100, Math.round(p[1] * 100) / 100]
}

function roundRing(ring) {
  return ring.map(roundPoint)
}

/** Drop consecutive duplicates after rounding. */
function dedupeRing(ring) {
  const out = []
  for (const p of ring) {
    const prev = out[out.length - 1]
    if (prev && prev[0] === p[0] && prev[1] === p[1]) continue
    out.push(p)
  }
  if (out.length >= 2) {
    const first = out[0]
    const last = out[out.length - 1]
    if (first[0] !== last[0] || first[1] !== last[1]) out.push([first[0], first[1]])
  }
  // collapse if close left only 2 points
  return out.length >= 4 ? out : null
}

function extractRings(geom) {
  const rings = []
  if (geom.type === 'Polygon') {
    // exterior only — holes not needed for silhouette fill
    if (geom.coordinates[0]) rings.push(geom.coordinates[0])
  } else if (geom.type === 'MultiPolygon') {
    for (const poly of geom.coordinates) {
      if (poly[0]) rings.push(poly[0])
    }
  }
  return rings
}

const geo = JSON.parse(readFileSync(src, 'utf8'))
const out = []

for (const feature of geo.features) {
  if (!feature.geometry) continue
  for (const ring of extractRings(feature.geometry)) {
    if (!ringTouchesFrame(ring)) continue
    const simplified = simplifyClosed(ring)
    if (!simplified) continue
    const rounded = dedupeRing(roundRing(simplified))
    if (!rounded || rounded.length < MIN_POINTS + 1) continue
    if (shoelaceArea(rounded) < MIN_AREA) continue
    out.push(rounded)
  }
}

// Largest first (main continents), then islands
out.sort((a, b) => shoelaceArea(b) - shoelaceArea(a))

const points = out.reduce((n, r) => n + r.length, 0)
console.log(`rings=${out.length} points=${points}`)

const body = out
  .map(
    (ring) =>
      '[' +
      ring.map(([lon, lat]) => `[${lon},${lat}]`).join(',') +
      ']',
  )
  .join(',')

const file = `/**
 * Land rings for Vitae campaign maps (Alexander + Caesar).
 * Source: Natural Earth 10m land (public domain), clipped to the campaign
 * frame and Douglas–Peucker simplified. Coordinates are [lon, lat] degrees —
 * project with geoMap at render time.
 *
 * Regenerate:
 *   node scripts/build-campaign-land.mjs path/to/ne_10m_land.geojson
 */

export type LonLat = readonly [number, number]

/** Exterior rings intersecting Britain → Indus, Egypt → Baltic. */
export const CAMPAIGN_LAND_RINGS: readonly (readonly LonLat[])[] =
[${body}] as const
`

const dest = resolve('src/lib/campaignLand.ts')
writeFileSync(dest, file)
console.log(`wrote ${dest} (${file.length} bytes)`)
