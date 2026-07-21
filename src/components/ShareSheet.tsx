import { useEffect, useId, useState } from 'react'
import {
  copyCitationText,
  copyQuoteImage,
  prepareShareAssets,
  shareViaIntent,
  type ShareAssets,
} from '../lib/shareQuote'
import './ShareSheet.css'

export type ShareSheetPayload = {
  quote: string
  workTitle: string
  workId: string
  paraId?: string
  /** Exact ranges for `?r=` deep-link (multi-para when present). */
  ranges?: Array<{ paraId: string; start: number; end: number }>
}

type Props = {
  open: boolean
  payload: ShareSheetPayload | null
  onClose: () => void
}

type Status = string | null

/**
 * Quiet Kindle-style share submenu: citation + card preview, then
 * X / Threads / copy quote / copy image.
 */
export function ShareSheet({ open, payload, onClose }: Props) {
  const titleId = useId()
  const [assets, setAssets] = useState<ShareAssets | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<Status>(null)

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    if (!open || !payload) {
      setAssets(null)
      setPreviewUrl(null)
      setLoading(false)
      setStatus(null)
      return
    }

    let cancelled = false
    let objectUrl: string | null = null
    setLoading(true)
    setStatus(null)
    setAssets(null)
    setPreviewUrl(null)

    void prepareShareAssets(payload)
      .then((next) => {
        if (cancelled) return
        const url = URL.createObjectURL(next.blob)
        if (cancelled) {
          URL.revokeObjectURL(url)
          return
        }
        objectUrl = url
        setAssets(next)
        setPreviewUrl(url)
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setLoading(false)
        setStatus('Couldn’t prepare share')
      })

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [open, payload])

  if (!open || !payload) return null

  const busy = loading || !assets

  async function onCopyQuote() {
    if (!assets) return
    const result = await copyCitationText(assets.citation)
    setStatus(result === 'copied' ? 'Quote copied' : 'Couldn’t copy quote')
  }

  async function onCopyImage() {
    if (!assets) return
    const result = await copyQuoteImage(assets.blob, assets.filename)
    if (result === 'copied') setStatus('Image copied')
    else if (result === 'downloaded') setStatus('Image saved')
    else setStatus('Couldn’t copy image')
  }

  function onShareX() {
    if (!assets) return
    const result = shareViaIntent('x', assets.shareText)
    setStatus(result === 'opened' ? null : 'Couldn’t open X')
    if (result === 'opened') onClose()
  }

  function onShareThreads() {
    if (!assets) return
    const result = shareViaIntent('threads', assets.shareText, assets.deepLink)
    setStatus(result === 'opened' ? null : 'Couldn’t open Threads')
    if (result === 'opened') onClose()
  }

  return (
    <div className="share-sheet-backdrop" onClick={onClose}>
      <div
        className="share-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <header className="share-sheet-header">
          <h2 id={titleId}>Share</h2>
          <button type="button" className="share-sheet-close" onClick={onClose}>
            Done
          </button>
        </header>

        <div className="share-sheet-body">
          <div className="share-sheet-preview">
            {previewUrl ? (
              <img
                className="share-sheet-card"
                src={previewUrl}
                alt="Quote card preview"
              />
            ) : (
              <div
                className="share-sheet-card-placeholder"
                aria-live="polite"
              >
                {loading
                  ? 'Preparing…'
                  : status
                    ? 'Preview unavailable'
                    : '—'}
              </div>
            )}
            {assets ? (
              <p className="share-sheet-citation">{assets.citation}</p>
            ) : null}
          </div>

          <div
            className="share-sheet-actions"
            role="group"
            aria-label="Share actions"
          >
            <button
              type="button"
              className="share-sheet-btn"
              disabled={busy}
              onClick={onShareX}
            >
              Share on X
            </button>
            <button
              type="button"
              className="share-sheet-btn"
              disabled={busy}
              onClick={onShareThreads}
            >
              Share on Threads
            </button>
            <button
              type="button"
              className="share-sheet-btn"
              disabled={busy}
              onClick={() => void onCopyQuote()}
            >
              Copy quote
            </button>
            <button
              type="button"
              className="share-sheet-btn"
              disabled={busy}
              onClick={() => void onCopyImage()}
            >
              Copy image
            </button>
          </div>
        </div>

        {status ? (
          <p className="share-sheet-status" role="status">
            {status}
          </p>
        ) : null}
      </div>
    </div>
  )
}
