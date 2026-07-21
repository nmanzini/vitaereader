import { useEffect, useId, useState } from 'react'
import {
  segmentText,
  type CharacterAnnotation,
} from '../lib/charMatch'
import './CharacterSheet.css'

type Props = {
  open: boolean
  character: CharacterAnnotation | null
  subject: string
  /** Full cast for resolving same-work name matches in the blurb. */
  characters: readonly CharacterAnnotation[]
  onClose: () => void
}

/** Small Kindle-like popup: tap outside or Close to dismiss. */
export function CharacterSheet({
  open,
  character,
  subject,
  characters,
  onClose,
}: Props) {
  const titleId = useId()
  const [viewing, setViewing] = useState<CharacterAnnotation | null>(null)
  const [history, setHistory] = useState<CharacterAnnotation[]>([])

  // Fresh open from the text resets the stack; in-sheet hops keep history.
  const openedId = open ? (character?.id ?? null) : null
  useEffect(() => {
    if (openedId == null || !character) {
      setViewing(null)
      setHistory([])
      return
    }
    setViewing(character)
    setHistory([])
  }, [openedId, character])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open || !viewing) return null

  const current = viewing
  const name = current.names[0] ?? current.id
  const others = characters.filter((c) => c.id !== current.id)
  const blurbSegments = segmentText(current.blurb, others)

  function openProfile(characterId: string) {
    const next = characters.find((c) => c.id === characterId)
    if (!next || next.id === current.id) return
    setHistory((h) => [...h, current])
    setViewing(next)
  }

  function goBack() {
    setHistory((h) => {
      if (h.length === 0) return h
      const prev = h[h.length - 1]!
      setViewing(prev)
      return h.slice(0, -1)
    })
  }

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
          <div className="char-sheet-title-row">
            {history.length > 0 ? (
              <button
                type="button"
                className="char-sheet-back"
                onClick={goBack}
                aria-label="Back to previous profile"
              >
                Back
              </button>
            ) : null}
            <h2 id={titleId}>{name}</h2>
          </div>
          <button type="button" className="char-sheet-close" onClick={onClose}>
            Close
          </button>
        </header>
        <p className="char-sheet-relation">
          {current.relation}
          {subject ? (
            <span className="char-sheet-subject"> · re {subject}</span>
          ) : null}
        </p>
        <p className="char-sheet-blurb">
          {blurbSegments.map((seg, i) =>
            seg.type === 'char' ? (
              <button
                key={`${seg.characterId}:${i}`}
                type="button"
                className="char-sheet-inline"
                onClick={() => openProfile(seg.characterId)}
              >
                {seg.text}
              </button>
            ) : (
              <span key={`t:${i}`}>{seg.text}</span>
            ),
          )}
        </p>
      </div>
    </div>
  )
}
