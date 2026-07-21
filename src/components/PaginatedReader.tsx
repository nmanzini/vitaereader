import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { pageIndexFromProgress, progressFromPage } from '../lib/reading'
import { applyColumnPageSize } from '../lib/paginationLayout'
import { usePageGestures } from '../lib/usePageGestures'

export type PageStatus = {
  page: number
  pageCount: number
  /** Content-anchored 0–1 ratio when measurable; else page-fraction fallback. */
  ratio: number
}

type Props = {
  contentKey: string
  children: ReactNode
  /** Content-anchored resume ratio (0–1). */
  initialProgress: number
  /** Prefer DOM content measure from the visible page clip. */
  measureProgress?: (clip: HTMLElement) => number | null
  /**
   * Resolve resume ratio → page index after columns lay out.
   * Should locate the page that actually contains the content anchor.
   */
  resolvePageIndex?: (
    content: HTMLElement,
    pageWidth: number,
    pageCount: number,
  ) => number
  onStatus: (status: PageStatus) => void
  onToggleChrome: () => void
  onExhausted?: () => void
}

/**
 * Kindle-style horizontal pages via CSS columns.
 *
 * Critical: the column box width is locked to exactly one page width so only
 * one column is visible inside the clip; extra columns overflow horizontally
 * and we translate by that same page width.
 */
export function PaginatedReader({
  contentKey,
  children,
  initialProgress,
  measureProgress,
  resolvePageIndex,
  onStatus,
  onToggleChrome,
  onExhausted,
}: Props) {
  const clipRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [page, setPage] = useState(0)
  const [pageCount, setPageCount] = useState(1)
  const [pageWidth, setPageWidth] = useState(0)
  const [dragOffset, setDragOffset] = useState(0)
  const [dragging, setDragging] = useState(false)
  const restored = useRef(false)
  const onStatusRef = useRef(onStatus)
  const measureRef = useRef(measureProgress)
  const resolveRef = useRef(resolvePageIndex)
  const exhaustedRef = useRef(onExhausted)
  const pageRef = useRef(0)
  const pageCountRef = useRef(1)
  const pageWidthRef = useRef(0)
  onStatusRef.current = onStatus
  measureRef.current = measureProgress
  resolveRef.current = resolvePageIndex
  exhaustedRef.current = onExhausted
  pageRef.current = page
  pageCountRef.current = pageCount
  pageWidthRef.current = pageWidth

  const measure = useCallback(() => {
    const clip = clipRef.current
    const content = contentRef.current
    if (!clip || !content) return

    const width = Math.max(1, Math.floor(clip.clientWidth))
    const pages = applyColumnPageSize(content, width, clip.clientHeight)
    setPageWidth(width)
    setPageCount(pages)
    setPage((p) => Math.min(p, pages - 1))
  }, [])

  useLayoutEffect(() => {
    restored.current = false
    setPage(0)
    setDragOffset(0)

    let frames = 0
    let raf = 0
    const waitForLayout = () => {
      frames += 1
      measure()
      if (frames < 4) raf = requestAnimationFrame(waitForLayout)
    }
    raf = requestAnimationFrame(waitForLayout)

    const clip = clipRef.current
    const ro = new ResizeObserver(() => measure())
    if (clip) ro.observe(clip)
    document.fonts?.ready.then(() => measure())

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [measure, contentKey])

  useLayoutEffect(() => {
    if (restored.current || pageCount < 1 || pageWidth === 0) return
    const content = contentRef.current
    let next = pageIndexFromProgress(initialProgress, pageCount)
    if (content && resolveRef.current) {
      next = resolveRef.current(content, pageWidth, pageCount)
    }
    setPage(next)
    restored.current = true
  }, [initialProgress, pageCount, pageWidth, contentKey])

  useEffect(() => {
    const clip = clipRef.current
    let raf = requestAnimationFrame(() => {
      let ratio = progressFromPage(page, pageCount)
      if (clip && measureRef.current) {
        const measured = measureRef.current(clip)
        if (measured != null) ratio = measured
      }
      onStatusRef.current({
        page: page + 1,
        pageCount,
        ratio,
      })
    })
    return () => cancelAnimationFrame(raf)
  }, [page, pageCount])

  const go = useCallback((delta: number) => {
    const count = pageCountRef.current
    setPage((p) => {
      const next = p + delta
      if (next < 0) return 0
      if (next >= count) {
        exhaustedRef.current?.()
        return p
      }
      return next
    })
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault()
        go(1)
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault()
        go(-1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go])

  usePageGestures({
    rootRef: clipRef,
    pageRef,
    pageCountRef,
    pageWidthRef,
    onGo: go,
    onTapCenter: onToggleChrome,
    onDragOffset: setDragOffset,
    onDragging: setDragging,
  })

  const x = pageWidth > 0 ? -page * pageWidth + dragOffset : dragOffset

  return (
    <div className="paged-viewport">
      <div className="paged-clip" ref={clipRef}>
        <div
          className={`paged-content${dragging ? ' is-dragging' : ''}`}
          ref={contentRef}
          style={{ transform: `translate3d(${x}px, 0, 0)` }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}
