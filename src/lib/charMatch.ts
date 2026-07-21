/**
 * Longest-match annotation name scanning for reader (characters + locations).
 * Pure: no DOM. Prefer longer surface forms first; never break mid-word.
 * On equal length, characters win over locations.
 */

/** Optional related-profile ref (smoke-validated; sheet uses in-blurb names). */
export type CharacterLink = {
  characterId: string
  workId?: string
  label?: string
}

export type CharacterAnnotation = {
  id: string
  /** Surface forms to match; put longer / canonical first in data. */
  names: string[]
  blurb: string
  relation: string
  /** Optional; not rendered — blurb name-match drives in-sheet hops. */
  links?: CharacterLink[]
}

/** Place tapped in the text; lat/lon feed the expandable sheet map. */
export type LocationAnnotation = {
  id: string
  /** Surface forms to match; put longer / canonical first in data. */
  names: string[]
  blurb: string
  relation: string
  lat: number
  lon: number
  /** Optional modern placename shown under the relation line. */
  modern?: string
}

export type WorkAnnotations = {
  workId: string
  subject: string
  characters: CharacterAnnotation[]
  /** Optional; missing or empty → no place highlights. */
  locations?: LocationAnnotation[]
}

export type CharMatch = {
  start: number
  end: number
  characterId: string
  text: string
}

export type LocMatch = {
  start: number
  end: number
  locationId: string
  text: string
}

export type AnnotationMatch =
  | (CharMatch & { kind: 'char' })
  | (LocMatch & { kind: 'loc' })

export type TextSegment =
  | { type: 'text'; text: string }
  | { type: 'char'; text: string; characterId: string }
  | { type: 'loc'; text: string; locationId: string }

/** Letter / digit / apostrophe — used for word-boundary checks. */
function isWordChar(ch: string | undefined): boolean {
  if (!ch) return false
  return /[A-Za-z0-9\u00C0-\u024F']/.test(ch)
}

type NamedEntity = {
  id: string
  names: string[]
  kind: 'char' | 'loc'
}

type NamePattern = {
  name: string
  id: string
  kind: 'char' | 'loc'
  lower: string
}

/** Flatten + sort names longest-first; equal length → char before loc, then alpha. */
function buildNamePatterns(entities: readonly NamedEntity[]): NamePattern[] {
  const patterns: NamePattern[] = []
  for (const e of entities) {
    for (const name of e.names) {
      const trimmed = name.trim()
      if (!trimmed) continue
      patterns.push({
        name: trimmed,
        id: e.id,
        kind: e.kind,
        lower: trimmed.toLowerCase(),
      })
    }
  }
  patterns.sort((a, b) => {
    const byLen = b.name.length - a.name.length
    if (byLen !== 0) return byLen
    if (a.kind !== b.kind) return a.kind === 'char' ? -1 : 1
    return a.name.localeCompare(b.name)
  })
  return patterns
}

function toEntities(
  characters: readonly CharacterAnnotation[],
  locations: readonly LocationAnnotation[] = [],
): NamedEntity[] {
  return [
    ...characters.map((c) => ({
      id: c.id,
      names: c.names,
      kind: 'char' as const,
    })),
    ...locations.map((l) => ({
      id: l.id,
      names: l.names,
      kind: 'loc' as const,
    })),
  ]
}

/**
 * Find non-overlapping name matches left-to-right, longest wins at each index.
 * Matching is case-insensitive; reported `text` preserves the source casing.
 */
export function findAnnotationMatches(
  text: string,
  characters: readonly CharacterAnnotation[],
  locations: readonly LocationAnnotation[] = [],
): AnnotationMatch[] {
  if (!text) return []
  const patterns = buildNamePatterns(toEntities(characters, locations))
  if (patterns.length === 0) return []

  const matches: AnnotationMatch[] = []
  let i = 0
  while (i < text.length) {
    let best: AnnotationMatch | null = null
    for (const p of patterns) {
      const end = i + p.name.length
      if (end > text.length) continue
      if (text.slice(i, end).toLowerCase() !== p.lower) continue
      if (isWordChar(text[i - 1]) || isWordChar(text[end])) continue
      const slice = text.slice(i, end)
      best =
        p.kind === 'char'
          ? { kind: 'char', start: i, end, characterId: p.id, text: slice }
          : { kind: 'loc', start: i, end, locationId: p.id, text: slice }
      break
    }
    if (best) {
      matches.push(best)
      i = best.end
    } else {
      i += 1
    }
  }
  return matches
}

/**
 * Find non-overlapping character name matches left-to-right, longest wins.
 * Matching is case-insensitive; reported `text` preserves the source casing.
 */
export function findCharacterMatches(
  text: string,
  characters: readonly CharacterAnnotation[],
): CharMatch[] {
  return findAnnotationMatches(text, characters, []).flatMap((m) =>
    m.kind === 'char'
      ? [
          {
            start: m.start,
            end: m.end,
            characterId: m.characterId,
            text: m.text,
          },
        ]
      : [],
  )
}

/** Location-only name scan (same rules as characters). */
export function findLocationMatches(
  text: string,
  locations: readonly LocationAnnotation[],
): LocMatch[] {
  return findAnnotationMatches(text, [], locations).flatMap((m) =>
    m.kind === 'loc'
      ? [
          {
            start: m.start,
            end: m.end,
            locationId: m.locationId,
            text: m.text,
          },
        ]
      : [],
  )
}

/** Split plain text into text / character-ref segments for rendering. */
export function segmentText(
  text: string,
  characters: readonly CharacterAnnotation[],
): TextSegment[] {
  return segmentAnnotationText(text, characters, [])
}

/** Split plain text into text / char / loc segments (location blurbs). */
export function segmentAnnotationText(
  text: string,
  characters: readonly CharacterAnnotation[],
  locations: readonly LocationAnnotation[],
): TextSegment[] {
  const matches = findAnnotationMatches(text, characters, locations)
  if (matches.length === 0) return [{ type: 'text', text }]

  const segments: TextSegment[] = []
  let cursor = 0
  for (const m of matches) {
    if (m.start > cursor) {
      segments.push({ type: 'text', text: text.slice(cursor, m.start) })
    }
    if (m.kind === 'char') {
      segments.push({
        type: 'char',
        text: m.text,
        characterId: m.characterId,
      })
    } else {
      segments.push({
        type: 'loc',
        text: m.text,
        locationId: m.locationId,
      })
    }
    cursor = m.end
  }
  if (cursor < text.length) {
    segments.push({ type: 'text', text: text.slice(cursor) })
  }
  return segments
}
