import type { ReactNode } from 'react'
import type { Paragraph } from '../content/types'
import {
  findCharacterMatches,
  type CharacterAnnotation,
  type NameResolution,
} from '../lib/charMatch'
import {
  segmentWithHighlights,
  type HighlightSpan,
} from '../lib/textRanges'

type Props = {
  paragraph: Paragraph
  characters?: readonly CharacterAnnotation[]
  /** LLM/reviewer span → characterId for ambiguous names in this work. */
  nameResolutions?: readonly NameResolution[]
  highlights?: readonly HighlightSpan[]
  onCharacter?: (characterId: string) => void
  /** Tap an existing highlight (not on a char-ref) — open remove/share toolbar. */
  onHighlight?: (highlightId: string, markEl: HTMLElement) => void
}

function wrapHighlight(
  nodes: ReactNode,
  highlightIds: string[],
  key: string,
  onHighlight: ((highlightId: string, markEl: HTMLElement) => void) | undefined,
): ReactNode {
  if (highlightIds.length === 0) return nodes
  const primaryId = highlightIds[0]!
  return (
    <mark
      key={key}
      className="text-highlight"
      data-hl-ids={highlightIds.join(' ')}
      data-testid="text-highlight"
      onClick={(e) => {
        // Char-ref buttons stopPropagation; only bare highlight taps land here.
        if (!onHighlight) return
        e.stopPropagation()
        const mark = e.currentTarget
        onHighlight(primaryId, mark)
      }}
    >
      {nodes}
    </mark>
  )
}

function renderSegments(
  text: string,
  characters: readonly CharacterAnnotation[] | undefined,
  highlights: readonly HighlightSpan[] | undefined,
  onCharacter: ((characterId: string) => void) | undefined,
  onHighlight: ((highlightId: string, markEl: HTMLElement) => void) | undefined,
  keyPrefix: string,
  paraId: string,
  nameResolutions: readonly NameResolution[] | undefined,
): ReactNode {
  const chars = characters?.length ? characters : []
  const hl = highlights?.length ? highlights : []
  if (chars.length === 0 && hl.length === 0) return text

  const matches = chars.length
    ? findCharacterMatches(text, chars, {
        paraId,
        resolutions: nameResolutions,
        ambiguous: 'skip',
      })
    : []
  const segments = segmentWithHighlights(text, matches, hl)

  return segments.map((seg, i) => {
    const key = `${keyPrefix}-${i}`
    if (seg.type === 'text') {
      if (seg.highlightIds.length === 0) {
        return <span key={key}>{seg.text}</span>
      }
      return wrapHighlight(seg.text, seg.highlightIds, key, onHighlight)
    }
    const btn = (
      <button
        type="button"
        className="char-ref"
        data-char-id={seg.characterId}
        aria-label={`About ${seg.text}`}
        onClick={(e) => {
          e.stopPropagation()
          onCharacter?.(seg.characterId)
        }}
      >
        {seg.text}
      </button>
    )
    if (seg.highlightIds.length === 0) {
      return <span key={key}>{btn}</span>
    }
    return wrapHighlight(btn, seg.highlightIds, key, onHighlight)
  })
}

export function ParagraphView({
  paragraph,
  characters,
  nameResolutions,
  highlights,
  onCharacter,
  onHighlight,
}: Props) {
  if (paragraph.kind !== 'poem') {
    return (
      <p
        className={`p-${paragraph.kind}`}
        id={`para-${paragraph.id}`}
        data-para-id={paragraph.id}
      >
        {renderSegments(
          paragraph.text,
          characters,
          highlights,
          onCharacter,
          onHighlight,
          paragraph.id,
          paragraph.id,
          nameResolutions,
        )}
      </p>
    )
  }

  const lines = paragraph.text.split('\n')
  // Poem offsets must match paragraph.text (newlines between lines).
  let offset = 0
  return (
    <p
      className="p-poem"
      id={`para-${paragraph.id}`}
      data-para-id={paragraph.id}
    >
      {lines.map((line, i) => {
        const lineStart = offset
        offset += line.length + (i < lines.length - 1 ? 1 : 0)
        const lineHighlights = (highlights ?? [])
          .map((h) => {
            const start = Math.max(h.start, lineStart) - lineStart
            const end = Math.min(h.end, lineStart + line.length) - lineStart
            if (end <= start) return null
            return { id: h.id, start, end }
          })
          .filter((h): h is HighlightSpan => h != null)

        // Poem lines are sliced; shift resolutions into line-local offsets.
        const lineResolutions = (nameResolutions ?? [])
          .filter(
            (r) =>
              r.paraId === paragraph.id &&
              r.start >= lineStart &&
              r.end <= lineStart + line.length,
          )
          .map((r) => ({
            ...r,
            start: r.start - lineStart,
            end: r.end - lineStart,
          }))

        return (
          <span key={i}>
            {renderSegments(
              line,
              characters,
              lineHighlights,
              onCharacter,
              onHighlight,
              `${paragraph.id}-L${i}`,
              paragraph.id,
              lineResolutions,
            )}
            {i < lines.length - 1 ? <br /> : null}
          </span>
        )
      })}
    </p>
  )
}
