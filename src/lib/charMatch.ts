/**
 * Longest-match annotation name scanning for reader (characters + locations).
 * Pure: no DOM. Prefer longer surface forms first; never break mid-word.
 * On equal length, characters win over locations.
 *
 * Shared character names (e.g. several Philips) are not guessed from the string
 * alone: work body text uses optional `nameResolutions` (LLM/reviewer span → id).
 * Character-sheet blurbs may fall back to the first cast entry for a name.
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

/**
 * Reviewer/LLM assignment for one character-name span in the work body.
 * Offsets are plain-paragraph offsets (same space as highlights).
 */
export type NameResolution = {
  paraId: string
  start: number
  end: number
  characterId: string
  /** Optional short rationale from the review pass (not shown in UI). */
  note?: string
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
  /**
   * Per-occurrence links for ambiguous character surface forms
   * (same name → many character ids). Unique names still resolve by
   * longest-match without entries here.
   */
  nameResolutions?: NameResolution[]
}

/**
 * True when this cast member is the Life’s subject (e.g. Alexander in
 * Alexander). Reader body text should not highlight the subject — you’re
 * already reading their story.
 */
export function isSubjectCharacter(
  character: CharacterAnnotation,
  subject: string,
  workId?: string,
): boolean {
  const subj = subject.trim().toLowerCase()
  if (!subj) return false
  if (workId && character.id === workId) return true
  const slug = subj.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  if (slug && (character.id === slug || character.id === `${slug}-subject`)) {
    return true
  }
  return character.names.some((n) => n.trim().toLowerCase() === subj)
}

/** Cast used for reader body highlights — subject of the Life omitted. */
export function charactersForReaderBody(
  characters: readonly CharacterAnnotation[],
  subject: string,
  workId?: string,
): CharacterAnnotation[] {
  return characters.filter((c) => !isSubjectCharacter(c, subject, workId))
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

export type FindCharacterMatchOptions = {
  /** Paragraph id — required for resolution lookup in work body. */
  paraId?: string
  /** Work-level resolutions; filtered by paraId when provided. */
  resolutions?: readonly NameResolution[]
  /**
   * Ambiguous character surface form with no covering resolution:
   * - `skip` (default): leave as plain text (reader body)
   * - `first`: use the first cast member that owns the name (sheet blurbs)
   */
  ambiguous?: 'skip' | 'first'
}

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
  kind: 'char' | 'loc'
  /** Owners of this surface form (multiple only for shared character names). */
  ids: string[]
  lower: string
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
 * Flatten + sort names longest-first; equal length → char before loc, then alpha.
 * Character surface forms shared by multiple cast members collapse to one pattern
 * with several ids (resolved via nameResolutions / ambiguous mode).
 */
function buildNamePatterns(entities: readonly NamedEntity[]): NamePattern[] {
  const byKey = new Map<
    string,
    { name: string; kind: 'char' | 'loc'; ids: string[] }
  >()
  for (const e of entities) {
    for (const name of e.names) {
      const trimmed = name.trim()
      if (!trimmed) continue
      const lower = trimmed.toLowerCase()
      const key = `${e.kind}:${lower}`
      const prev = byKey.get(key)
      if (!prev) {
        byKey.set(key, { name: trimmed, kind: e.kind, ids: [e.id] })
        continue
      }
      if (!prev.ids.includes(e.id)) prev.ids.push(e.id)
    }
  }

  const patterns: NamePattern[] = []
  for (const { name, kind, ids } of byKey.values()) {
    patterns.push({
      name,
      kind,
      ids,
      lower: name.toLowerCase(),
    })
  }
  patterns.sort((a, b) => {
    const byLen = b.name.length - a.name.length
    if (byLen !== 0) return byLen
    if (a.kind !== b.kind) return a.kind === 'char' ? -1 : 1
    return a.name.localeCompare(b.name)
  })
  return patterns
}

function resolutionForSpan(
  resolutions: readonly NameResolution[] | undefined,
  paraId: string | undefined,
  start: number,
  end: number,
): NameResolution | null {
  if (!resolutions?.length || !paraId) return null
  for (const r of resolutions) {
    if (r.paraId !== paraId) continue
    if (r.start === start && r.end === end) return r
  }
  return null
}

function resolveCharacterId(
  characterIds: readonly string[],
  start: number,
  end: number,
  opts: FindCharacterMatchOptions | undefined,
): string | null {
  if (characterIds.length === 1) return characterIds[0]!

  const hit = resolutionForSpan(
    opts?.resolutions,
    opts?.paraId,
    start,
    end,
  )
  if (hit && characterIds.includes(hit.characterId)) {
    return hit.characterId
  }
  if (opts?.ambiguous === 'first') return characterIds[0]!
  return null
}

/**
 * Find non-overlapping name matches left-to-right, longest wins at each index.
 * Matching is case-insensitive; reported `text` preserves the source casing.
 * Ambiguous character names need a covering `nameResolutions` entry
 * (unless `ambiguous: 'first'`).
 */
export function findAnnotationMatches(
  text: string,
  characters: readonly CharacterAnnotation[],
  locations: readonly LocationAnnotation[] = [],
  opts?: FindCharacterMatchOptions,
): AnnotationMatch[] {
  if (!text) return []
  const patterns = buildNamePatterns(toEntities(characters, locations))
  if (patterns.length === 0) return []

  const matches: AnnotationMatch[] = []
  let i = 0
  while (i < text.length) {
    let advanced = false
    for (const p of patterns) {
      const end = i + p.name.length
      if (end > text.length) continue
      if (text.slice(i, end).toLowerCase() !== p.lower) continue
      if (isWordChar(text[i - 1]) || isWordChar(text[end])) continue

      const slice = text.slice(i, end)
      if (p.kind === 'loc') {
        matches.push({
          kind: 'loc',
          start: i,
          end,
          locationId: p.ids[0]!,
          text: slice,
        })
        i = end
        advanced = true
        break
      }

      const characterId = resolveCharacterId(p.ids, i, end, opts)
      if (!characterId) {
        // Ambiguous and unresolved: try shorter patterns at this index.
        continue
      }
      matches.push({
        kind: 'char',
        start: i,
        end,
        characterId,
        text: slice,
      })
      i = end
      advanced = true
      break
    }
    if (!advanced) i += 1
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
  opts?: FindCharacterMatchOptions,
): CharMatch[] {
  return findAnnotationMatches(text, characters, [], opts).flatMap((m) =>
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
  opts?: FindCharacterMatchOptions,
): TextSegment[] {
  return segmentAnnotationText(text, characters, [], opts)
}

/** Split plain text into text / char / loc segments (location blurbs). */
export function segmentAnnotationText(
  text: string,
  characters: readonly CharacterAnnotation[],
  locations: readonly LocationAnnotation[],
  opts?: FindCharacterMatchOptions,
): TextSegment[] {
  const matches = findAnnotationMatches(text, characters, locations, opts)
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

/** Index resolutions by paragraph for O(1) handoff into ParagraphView. */
export function resolutionsByPara(
  resolutions: readonly NameResolution[] | undefined,
): Map<string, NameResolution[]> {
  const map = new Map<string, NameResolution[]>()
  if (!resolutions?.length) return map
  for (const r of resolutions) {
    const list = map.get(r.paraId)
    if (list) list.push(r)
    else map.set(r.paraId, [r])
  }
  return map
}
