/**
 * Longest-match character name scanning for reader annotations.
 * Pure: no DOM. Prefer longer surface forms first; never break mid-word.
 *
 * Shared names (e.g. several Philips) are not guessed from the string alone:
 * work body text uses optional `nameResolutions` (LLM/reviewer span → id).
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
 * Reviewer/LLM assignment for one name span in the work body.
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

export type WorkAnnotations = {
  workId: string
  subject: string
  characters: CharacterAnnotation[]
  /**
   * Per-occurrence links for ambiguous surface forms (same name → many ids).
   * Unique names still resolve by longest-match without entries here.
   */
  nameResolutions?: NameResolution[]
}

export type CharMatch = {
  start: number
  end: number
  characterId: string
  text: string
}

export type TextSegment =
  | { type: 'text'; text: string }
  | { type: 'char'; text: string; characterId: string }

export type FindCharacterMatchOptions = {
  /** Paragraph id — required for resolution lookup in work body. */
  paraId?: string
  /** Work-level resolutions; filtered by paraId when provided. */
  resolutions?: readonly NameResolution[]
  /**
   * Ambiguous surface form with no covering resolution:
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

type NamePattern = {
  name: string
  /** Cast members that list this exact surface form (case-insensitive). */
  characterIds: string[]
  lower: string
}

/** Flatten + sort names longest-first (stable for equal lengths). */
function buildNamePatterns(
  characters: readonly CharacterAnnotation[],
): NamePattern[] {
  const byLower = new Map<string, { name: string; characterIds: string[] }>()
  for (const c of characters) {
    for (const name of c.names) {
      const trimmed = name.trim()
      if (!trimmed) continue
      const lower = trimmed.toLowerCase()
      const prev = byLower.get(lower)
      if (!prev) {
        byLower.set(lower, { name: trimmed, characterIds: [c.id] })
        continue
      }
      if (!prev.characterIds.includes(c.id)) {
        prev.characterIds.push(c.id)
      }
    }
  }

  const patterns: NamePattern[] = []
  for (const { name, characterIds } of byLower.values()) {
    patterns.push({
      name,
      characterIds,
      lower: name.toLowerCase(),
    })
  }
  patterns.sort((a, b) => {
    const byLen = b.name.length - a.name.length
    if (byLen !== 0) return byLen
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
 * Ambiguous names need a covering `nameResolutions` entry (unless `ambiguous: 'first'`).
 */
export function findCharacterMatches(
  text: string,
  characters: readonly CharacterAnnotation[],
  opts?: FindCharacterMatchOptions,
): CharMatch[] {
  if (!text || characters.length === 0) return []

  const patterns = buildNamePatterns(characters)
  if (patterns.length === 0) return []

  const matches: CharMatch[] = []
  let i = 0
  while (i < text.length) {
    let advanced = false
    for (const p of patterns) {
      const end = i + p.name.length
      if (end > text.length) continue
      if (text.slice(i, end).toLowerCase() !== p.lower) continue
      if (isWordChar(text[i - 1]) || isWordChar(text[end])) continue

      const characterId = resolveCharacterId(p.characterIds, i, end, opts)
      if (!characterId) {
        // Ambiguous and unresolved: do not consume; try shorter patterns, else skip char.
        continue
      }
      matches.push({
        start: i,
        end,
        characterId,
        text: text.slice(i, end),
      })
      i = end
      advanced = true
      break
    }
    if (!advanced) i += 1
  }
  return matches
}

/** Split plain text into text / character-ref segments for rendering. */
export function segmentText(
  text: string,
  characters: readonly CharacterAnnotation[],
  opts?: FindCharacterMatchOptions,
): TextSegment[] {
  const matches = findCharacterMatches(text, characters, opts)
  if (matches.length === 0) return [{ type: 'text', text }]

  const segments: TextSegment[] = []
  let cursor = 0
  for (const m of matches) {
    if (m.start > cursor) {
      segments.push({ type: 'text', text: text.slice(cursor, m.start) })
    }
    segments.push({
      type: 'char',
      text: m.text,
      characterId: m.characterId,
    })
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
