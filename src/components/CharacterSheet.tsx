import { useEffect, useId } from 'react'
import type { CharacterAnnotation } from '../lib/charMatch'
import './CharacterSheet.css'

type Props = {
  open: boolean
  character: CharacterAnnotation | null
  subject: string
  onClose: () => void
}

/** Small Kindle-like popup: tap outside or Close to dismiss. */
export function CharacterSheet({ open, character, subject, onClose }: Props) {
  const titleId = useId()

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open || !character) return null

  const name = character.names[0] ?? character.id

  return (
    <div className="char-sheet-backdrop" onClick={onClose}>
      <div
        className="char-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="char-sheet-header">
          <h2 id={titleId}>{name}</h2>
          <button type="button" className="char-sheet-close" onClick={onClose}>
            Close
          </button>
        </header>
        <p className="char-sheet-relation">
          {character.relation}
          {subject ? (
            <span className="char-sheet-subject"> · re {subject}</span>
          ) : null}
        </p>
        <p className="char-sheet-blurb">{character.blurb}</p>
      </div>
    </div>
  )
}
