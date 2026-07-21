import type { ReactNode } from 'react'
import type { Paragraph } from '../content/types'
import {
  findAnnotationMatches,
  type CharacterAnnotation,
  type LocationAnnotation,
} from '../lib/charMatch'
import {
  segmentWithHighlights,
  type EntitySpan,
  type HighlightSpan,
} from '../lib/textRanges'

type Props = {
  paragraph: Paragraph
  characters?: readonly CharacterAnnotation[]
  locations?: readonly LocationAnnotation[]
  highlights?: readonly HighlightSpan[]
  onCharacter?: (characterId: string) => void
  onLocation?: (locationId: string) => void
  /** Tap an existing highlight (not on a char/loc-ref) — open remove/share toolbar. */
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
        // Annotation-ref buttons stopPropagation; only bare highlight taps land here.
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
  locations: readonly LocationAnnotation[] | undefined,
  highlights: readonly HighlightSpan[] | undefined,
  onCharacter: ((characterId: string) => void) | undefined,
  onLocation: ((locationId: string) => void) | undefined,
  onHighlight: ((highlightId: string, markEl: HTMLElement) => void) | undefined,
  keyPrefix: string,
): ReactNode {
  const chars = characters?.length ? characters : []
  const locs = locations?.length ? locations : []
  const hl = highlights?.length ? highlights : []
  if (chars.length === 0 && locs.length === 0 && hl.length === 0) return text

  const matches = findAnnotationMatches(text, chars, locs)
  const entities: EntitySpan[] = matches.map((m) =>
    m.kind === 'char'
      ? { kind: 'char', start: m.start, end: m.end, id: m.characterId }
      : { kind: 'loc', start: m.start, end: m.end, id: m.locationId },
  )
  const segments = segmentWithHighlights(text, entities, hl)

  return segments.map((seg, i) => {
    const key = `${keyPrefix}-${i}`
    if (seg.type === 'text') {
      if (seg.highlightIds.length === 0) {
        return <span key={key}>{seg.text}</span>
      }
      return wrapHighlight(seg.text, seg.highlightIds, key, onHighlight)
    }
    if (seg.type === 'char') {
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
    }
    const locBtn = (
      <button
        type="button"
        className="loc-ref"
        data-loc-id={seg.locationId}
        aria-label={`Place: ${seg.text}`}
        onClick={(e) => {
          e.stopPropagation()
          onLocation?.(seg.locationId)
        }}
      >
        {seg.text}
      </button>
    )
    if (seg.highlightIds.length === 0) {
      return <span key={key}>{locBtn}</span>
    }
    return wrapHighlight(locBtn, seg.highlightIds, key, onHighlight)
  })
}

export function ParagraphView({
  paragraph,
  characters,
  locations,
  highlights,
  onCharacter,
  onLocation,
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
          locations,
          highlights,
          onCharacter,
          onLocation,
          onHighlight,
          paragraph.id,
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

        return (
          <span key={i}>
            {renderSegments(
              line,
              characters,
              locations,
              lineHighlights,
              onCharacter,
              onLocation,
              onHighlight,
              `${paragraph.id}-L${i}`,
            )}
            {i < lines.length - 1 ? <br /> : null}
          </span>
        )
      })}
    </p>
  )
}
