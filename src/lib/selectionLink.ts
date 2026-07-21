/**
 * Compact encode/decode for share deep-links to exact quote ranges.
 * Token is base64url (no padding) of a small binary payload.
 *
 * Binary layout (version 1):
 *   ver:u8 | n:u8 | repeated n times:
 *     paraLen:u8 | paraId:utf8 | start:u32le | end:u32le
 */

export type SelectionRange = {
  paraId: string
  start: number
  end: number
}

const VERSION = 1
const MAX_SEGMENTS = 32
const MAX_PARA_ID = 64

const B64 =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

function toBase64Url(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]!
    const b = i + 1 < bytes.length ? bytes[i + 1]! : 0
    const c = i + 2 < bytes.length ? bytes[i + 2]! : 0
    const triple = (a << 16) | (b << 8) | c
    out += B64[(triple >> 18) & 63]
    out += B64[(triple >> 12) & 63]
    out += i + 1 < bytes.length ? B64[(triple >> 6) & 63] : ''
    out += i + 2 < bytes.length ? B64[triple & 63] : ''
  }
  return out.replace(/\+/g, '-').replace(/\//g, '_')
}

function fromBase64Url(token: string): Uint8Array | null {
  const cleaned = token
    .trim()
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .replace(/[^A-Za-z0-9+/]/g, '')
  if (!cleaned) return null
  const pad =
    cleaned.length % 4 === 0
      ? cleaned
      : cleaned + '='.repeat(4 - (cleaned.length % 4))
  const out: number[] = []
  for (let i = 0; i < pad.length; i += 4) {
    const a = B64.indexOf(pad[i]!)
    const b = B64.indexOf(pad[i + 1]!)
    const c = pad[i + 2] === '=' ? 0 : B64.indexOf(pad[i + 2]!)
    const d = pad[i + 3] === '=' ? 0 : B64.indexOf(pad[i + 3]!)
    if (a < 0 || b < 0 || c < 0 || d < 0) return null
    const triple = (a << 18) | (b << 12) | (c << 6) | d
    out.push((triple >> 16) & 255)
    if (pad[i + 2] !== '=') out.push((triple >> 8) & 255)
    if (pad[i + 3] !== '=') out.push(triple & 255)
  }
  return new Uint8Array(out)
}

function writeU32(view: DataView, offset: number, value: number): void {
  view.setUint32(offset, value >>> 0, true)
}

function readU32(view: DataView, offset: number): number {
  return view.getUint32(offset, true)
}

function normalizeSegment(
  range: SelectionRange,
): SelectionRange | null {
  const paraId = range.paraId?.trim()
  if (!paraId || paraId.length > MAX_PARA_ID) return null
  const start = Math.floor(range.start)
  const end = Math.floor(range.end)
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null
  if (start < 0 || end <= start) return null
  if (start > 0xffff_ffff || end > 0xffff_ffff) return null
  return { paraId, start, end }
}

/** Encode one or more paragraph ranges into a compact URL token. */
export function encodeSelectionRanges(
  ranges: readonly SelectionRange[],
): string | null {
  const segs: SelectionRange[] = []
  for (const r of ranges) {
    const n = normalizeSegment(r)
    if (n) segs.push(n)
    if (segs.length >= MAX_SEGMENTS) break
  }
  if (segs.length === 0) return null

  const enc = new TextEncoder()
  const paraBytes = segs.map((s) => enc.encode(s.paraId))
  let size = 2
  for (const pb of paraBytes) size += 1 + pb.length + 8

  const buf = new Uint8Array(size)
  const view = new DataView(buf.buffer)
  buf[0] = VERSION
  buf[1] = segs.length
  let o = 2
  for (let i = 0; i < segs.length; i++) {
    const pb = paraBytes[i]!
    const seg = segs[i]!
    buf[o++] = pb.length
    buf.set(pb, o)
    o += pb.length
    writeU32(view, o, seg.start)
    o += 4
    writeU32(view, o, seg.end)
    o += 4
  }
  return toBase64Url(buf)
}

/** Decode a share token; null if malformed or empty. */
export function decodeSelectionRanges(
  token: string,
): SelectionRange[] | null {
  const bytes = fromBase64Url(token)
  if (!bytes || bytes.length < 2) return null
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const ver = bytes[0]!
  const n = bytes[1]!
  if (ver !== VERSION || n < 1 || n > MAX_SEGMENTS) return null

  const dec = new TextDecoder()
  const out: SelectionRange[] = []
  let o = 2
  for (let i = 0; i < n; i++) {
    if (o >= bytes.length) return null
    const paraLen = bytes[o++]!
    if (
      paraLen < 1 ||
      paraLen > MAX_PARA_ID ||
      o + paraLen + 8 > bytes.length
    ) {
      return null
    }
    const paraId = dec.decode(bytes.subarray(o, o + paraLen)).trim()
    o += paraLen
    const start = readU32(view, o)
    o += 4
    const end = readU32(view, o)
    o += 4
    const seg = normalizeSegment({ paraId, start, end })
    if (!seg) return null
    out.push(seg)
  }
  if (o !== bytes.length) return null
  return out
}
