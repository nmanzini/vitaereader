import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import './SelectionToolbar.css'

export type SelectionToolbarAction = 'highlight' | 'remove' | 'share' | 'copy'

type Props = {
  open: boolean
  /** Anchor rect in client coordinates (selection line). */
  anchor: DOMRect | null
  /** When selection sits inside an existing highlight. */
  canRemove?: boolean
  onAction: (action: SelectionToolbarAction) => void
  onDismiss: () => void
}

/**
 * Tiny Kindle-like selection menu — touch-first, no hover reliance.
 * Positioned near the selection; flips above/below to stay on screen.
 */
export function SelectionToolbar({
  open,
  anchor,
  canRemove = false,
  onAction,
  onDismiss,
}: Props) {
  const labelId = useId()
  const barRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)

  useLayoutEffect(() => {
    if (!open || !anchor) {
      setPos(null)
      return
    }
    const bar = barRef.current
    const w = bar?.offsetWidth ?? 220
    const h = bar?.offsetHeight ?? 44
    const pad = 8
    const midX = anchor.left + anchor.width / 2
    let left = midX - w / 2
    left = Math.max(pad, Math.min(left, window.innerWidth - w - pad))

    const below = anchor.bottom + 10
    const above = anchor.top - h - 10
    const top =
      below + h + pad < window.innerHeight
        ? below
        : Math.max(pad, above)

    setPos({ left, top })
  }, [open, anchor])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onDismiss()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onDismiss])

  if (!open || !anchor) return null

  return (
    <div
      className="selection-toolbar-layer"
      onPointerDown={(e) => {
        // Clicks on the dim area clear; clicks on the bar stay.
        if (e.target === e.currentTarget) onDismiss()
      }}
    >
      <div
        ref={barRef}
        className="selection-toolbar"
        role="toolbar"
        aria-labelledby={labelId}
        style={
          pos
            ? { left: pos.left, top: pos.top, visibility: 'visible' }
            : { left: 0, top: 0, visibility: 'hidden' }
        }
        onPointerDown={(e) => e.stopPropagation()}
      >
        <span id={labelId} className="sr-only">
          Selection
        </span>
        <button
          type="button"
          className="selection-toolbar-btn"
          onClick={() => onAction(canRemove ? 'remove' : 'highlight')}
        >
          {canRemove ? 'Remove' : 'Highlight'}
        </button>
        <button
          type="button"
          className="selection-toolbar-btn"
          onClick={() => onAction('share')}
        >
          Share on X
        </button>
        <button
          type="button"
          className="selection-toolbar-btn"
          onClick={() => onAction('copy')}
        >
          Copy
        </button>
      </div>
    </div>
  )
}
