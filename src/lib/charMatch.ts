/**
 * Longest-match character name scanning for reader annotations.
 * Pure: no DOM. Prefer longer surface forms first; never break mid-word.
 */

/** Tappable related-profile ref from a character sheet. */
export type CharacterLink = {
  /** Target character `id` (same-work unless `workId` is set). */
  characterId: string
  /** Other Life’s annotation file; omit for same-work links. */
  workId?: string
  /** Button label; defaults to the target’s first name when same-work. */
  label?: string
}

export type CharacterAnnotation = {
  id: string
  /** Surface forms to match; put longer / canonical first in data. */
  names: string[]
  blurb: string
  relation: string
  /** Related profiles (same-work preferred; optional cross-life). */
  links?: CharacterLink[]
}

export type WorkAnnotations = {
  workId: string
  subject: string
  characters: CharacterAnnotation[]
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

/** Letter / digit / apostrophe — used for word-boundary checks. */
function isWordChar(ch: string | undefined): boolean {
  if (!ch) return false
  return /[A-Za-z0-9\u00C0-\u024F']/.test(ch)
}

type NamePattern = {
  name: string
  characterId: string
  lower: string
}

/** Flatten + sort names longest-first (stable for equal lengths). */
function buildNamePatterns(
  characters: readonly CharacterAnnotation[],
): NamePattern[] {
  const patterns: NamePattern[] = []
  for (const c of characters) {
    for (const name of c.names) {
      const trimmed = name.trim()
      if (!trimmed) continue
      patterns.push({
        name: trimmed,
        characterId: c.id,
        lower: trimmed.toLowerCase(),
      })
    }
  }
  patterns.sort((a, b) => {
    const byLen = b.name.length - a.name.length
    if (byLen !== 0) return byLen
    return a.name.localeCompare(b.name)
  })
  return patterns
}

/**
 * Find non-overlapping name matches left-to-right, longest wins at each index.
 * Matching is case-insensitive; reported `text` preserves the source casing.
 */
export function findCharacterMatches(
  text: string,
  characters: readonly CharacterAnnotation[],
): CharMatch[] {
  if (!text || characters.length === 0) return []

  const patterns = buildNamePatterns(characters)
  if (patterns.length === 0) return []

  const matches: CharMatch[] = []
  let i = 0
  while (i < text.length) {
    let best: CharMatch | null = null
    for (const p of patterns) {
      const end = i + p.name.length
      if (end > text.length) continue
      if (text.slice(i, end).toLowerCase() !== p.lower) continue
      if (isWordChar(text[i - 1]) || isWordChar(text[end])) continue
      best = {
        start: i,
        end,
        characterId: p.characterId,
        text: text.slice(i, end),
      }
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

/** Split plain text into text / character-ref segments for rendering. */
export function segmentText(
  text: string,
  characters: readonly CharacterAnnotation[],
): TextSegment[] {
  const matches = findCharacterMatches(text, characters)
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
