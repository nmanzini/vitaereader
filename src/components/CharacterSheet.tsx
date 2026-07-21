import { useEffect, useId, useState } from 'react'
import { Link } from 'react-router-dom'
import type { CharacterAnnotation, CharacterLink } from '../lib/charMatch'
import './CharacterSheet.css'

type Props = {
  open: boolean
  character: CharacterAnnotation | null
  subject: string
  /** Full cast for resolving same-work link targets. */
  characters: readonly CharacterAnnotation[]
  currentWorkId: string
  onClose: () => void
}

function linkLabel(
  link: CharacterLink,
  characters: readonly CharacterAnnotation[],
): string {
  if (link.label?.trim()) return link.label.trim()
  const hit = characters.find((c) => c.id === link.characterId)
  return hit?.names[0] ?? link.characterId
}

/** Small Kindle-like popup: tap outside or Close to dismiss. */
export function CharacterSheet({
  open,
  character,
  subject,
  characters,
  currentWorkId,
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

  const name = viewing.names[0] ?? viewing.id
  const links = viewing.links ?? []

  function openSameWork(characterId: string) {
    const next = characters.find((c) => c.id === characterId)
    if (!next || !viewing) return
    if (next.id === viewing.id) return
    setHistory((h) => [...h, viewing])
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
          {viewing.relation}
          {subject ? (
            <span className="char-sheet-subject"> · re {subject}</span>
          ) : null}
        </p>
        <p className="char-sheet-blurb">{viewing.blurb}</p>
        {links.length > 0 ? (
          <nav className="char-sheet-links" aria-label="Related profiles">
            {links.map((link) => {
              const cross =
                link.workId != null && link.workId !== currentWorkId
              const label = linkLabel(link, characters)
              if (cross) {
                return (
                  <Link
                    key={`${link.workId}:${link.characterId}:${label}`}
                    className="char-sheet-link"
                    to={`/read/${link.workId}`}
                    onClick={onClose}
                  >
                    {label}
                    <span className="char-sheet-link-note"> · other Life</span>
                  </Link>
                )
              }
              const available = characters.some(
                (c) => c.id === link.characterId,
              )
              if (!available) return null
              return (
                <button
                  key={`same:${link.characterId}:${label}`}
                  type="button"
                  className="char-sheet-link"
                  onClick={() => openSameWork(link.characterId)}
                >
                  {label}
                </button>
              )
            })}
          </nav>
        ) : null}
      </div>
    </div>
  )
}
