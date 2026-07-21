import type { ReactNode } from 'react'
import type { Paragraph } from '../content/types'
import {
  segmentText,
  type CharacterAnnotation,
} from '../lib/charMatch'

type Props = {
  paragraph: Paragraph
  characters?: readonly CharacterAnnotation[]
  onCharacter?: (characterId: string) => void
}

function renderSegments(
  text: string,
  characters: readonly CharacterAnnotation[] | undefined,
  onCharacter: ((characterId: string) => void) | undefined,
  keyPrefix: string,
): ReactNode {
  if (!characters?.length || !onCharacter) return text

  const segments = segmentText(text, characters)
  return segments.map((seg, i) => {
    const key = `${keyPrefix}-${i}`
    if (seg.type === 'text') return <span key={key}>{seg.text}</span>
    return (
      <button
        key={key}
        type="button"
        className="char-ref"
        data-char-id={seg.characterId}
        aria-label={`About ${seg.text}`}
        onClick={(e) => {
          e.stopPropagation()
          onCharacter(seg.characterId)
        }}
      >
        {seg.text}
      </button>
    )
  })
}

export function ParagraphView({
  paragraph,
  characters,
  onCharacter,
}: Props) {
  if (paragraph.kind !== 'poem') {
    return (
      <p className={`p-${paragraph.kind}`} data-para-id={paragraph.id}>
        {renderSegments(
          paragraph.text,
          characters,
          onCharacter,
          paragraph.id,
        )}
      </p>
    )
  }

  const lines = paragraph.text.split('\n')
  return (
    <p className="p-poem" data-para-id={paragraph.id}>
      {lines.map((line, i) => (
        <span key={i}>
          {renderSegments(
            line,
            characters,
            onCharacter,
            `${paragraph.id}-L${i}`,
          )}
          {i < lines.length - 1 ? <br /> : null}
        </span>
      ))}
    </p>
  )
}
