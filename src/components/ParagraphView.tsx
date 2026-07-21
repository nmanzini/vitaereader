import type { Paragraph } from '../content/types'

export function ParagraphView({ paragraph }: { paragraph: Paragraph }) {
  if (paragraph.kind !== 'poem') {
    return (
      <p className={`p-${paragraph.kind}`} data-para-id={paragraph.id}>
        {paragraph.text}
      </p>
    )
  }

  const lines = paragraph.text.split('\n')
  return (
    <p className="p-poem" data-para-id={paragraph.id}>
      {lines.map((line, i) => (
        <span key={i}>
          {line}
          {i < lines.length - 1 ? <br /> : null}
        </span>
      ))}
    </p>
  )
}
