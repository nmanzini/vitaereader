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
import { observeSize, setTransformX } from '../lib/kindleCompat'
import { usePageGestures } from '../lib/usePageGestures'

export type PageStatus = {
  page: number
  pageCount: number
  /** Content-anchored 0–1 ratio when measurable; else page-fraction fallback. */
  ratio: number
}

type Props = {
  contentKey: string
  /**
   * Typography / margin signature. When it changes, columns remasure and
   * snap back to the content-anchored ratio (not page index × count).
   */
  layoutKey?: string
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
 *
 * Viewport is full-bleed for margin tap zones; the stage/clip stays measure-wide.
 */
export function PaginatedReader({
  contentKey,
  layoutKey = '',
  children,
  initialProgress,
  measureProgress,
  resolvePageIndex,
  onStatus,
  onToggleChrome,
  onExhausted,
}: Props) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const clipRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [page, setPage] = useState(0)
  const [pageCount, setPageCount] = useState(1)
  const [pageWidth, setPageWidth] = useState(0)
  const [dragging, setDragging] = useState(false)
  /** Hidden until columns + resume page are positioned (no flash). */
  const [settled, setSettled] = useState(false)
  /** Soft page motion only after restore snap — never animate into saved place. */
  const [allowMotion, setAllowMotion] = useState(false)
  const restored = useRef(false)
  const resumeRatioRef = useRef(initialProgress)
  const initialProgressRef = useRef(initialProgress)
  initialProgressRef.current = initialProgress
  const onStatusRef = useRef(onStatus)
  const measureRef = useRef(measureProgress)
  const resolveRef = useRef(resolvePageIndex)
  const exhaustedRef = useRef(onExhausted)
  const pageRef = useRef(0)
  const pageCountRef = useRef(1)
  const pageWidthRef = useRef(0)
  /** Finger follow — updated imperatively so drag does not re-render React. */
  const dragOffsetRef = useRef(0)
  onStatusRef.current = onStatus
  measureRef.current = measureProgress
  resolveRef.current = resolvePageIndex
  exhaustedRef.current = onExhausted
  pageRef.current = page
  pageCountRef.current = pageCount
  pageWidthRef.current = pageWidth

  const layoutEpoch = `${contentKey}::${layoutKey}`

  const paintX = useCallback(() => {
    const el = contentRef.current
    if (!el) return
    const w = pageWidthRef.current
    const p = pageRef.current
    const x = w > 0 ? -p * w + dragOffsetRef.current : dragOffsetRef.current
    setTransformX(el, x)
  }, [])

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
    // Capture live content ratio at the moment type/layout invalidates.
    resumeRatioRef.current = initialProgressRef.current
    restored.current = false
    setSettled(false)
    setAllowMotion(false)
    setPage(0)
    dragOffsetRef.current = 0

    let frames = 0
    let raf = 0
    const waitForLayout = () => {
      frames += 1
      measure()
      if (frames < 4) raf = requestAnimationFrame(waitForLayout)
    }
    raf = requestAnimationFrame(waitForLayout)

    const clip = clipRef.current
    const stopObserve = clip ? observeSize(clip, measure) : () => {}
    // display=optional fonts: remasure only after restore if a face activates.
    const fonts = document.fonts
    if (fonts && fonts.ready) {
      void fonts.ready.then(() => {
        if (restored.current) measure()
      })
    }

    return () => {
      cancelAnimationFrame(raf)
      stopObserve()
    }
  }, [measure, layoutEpoch])

  // Content-anchored restore: snap transform before reveal — no tween to place.
  useLayoutEffect(() => {
    if (restored.current || pageCount < 1 || pageWidth === 0) return
    const content = contentRef.current
    const ratio = resumeRatioRef.current
    let next = pageIndexFromProgress(ratio, pageCount)
    if (content && resolveRef.current) {
      next = resolveRef.current(content, pageWidth, pageCount)
    }
    next = Math.max(0, Math.min(next, pageCount - 1))
    setPage(next)
    pageRef.current = next
    dragOffsetRef.current = 0
    if (content) setTransformX(content, -next * pageWidth)
    restored.current = true
    setSettled(true)
  }, [pageCount, pageWidth, layoutEpoch])

  // Enable soft motion only after the snapped page has painted.
  useEffect(() => {
    if (!settled) {
      setAllowMotion(false)
      return
    }
    let raf2 = 0
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setAllowMotion(true))
    })
    return () => {
      cancelAnimationFrame(raf1)
      cancelAnimationFrame(raf2)
    }
  }, [settled, layoutEpoch])

  // Keep a live ref so page-turn status can wait for motion without
  // re-running when allowMotion flips true after a restore snap.
  const allowMotionRef = useRef(allowMotion)
  allowMotionRef.current = allowMotion

  useEffect(() => {
    const clip = clipRef.current
    const content = contentRef.current
    if (!clip || pageWidth === 0) return

    let cancelled = false
    let raf = 0
    let timer = 0

    const report = () => {
      if (cancelled) return
      let ratio = progressFromPage(page, pageCount)
      if (measureRef.current) {
        const measured = measureRef.current(clip)
        if (measured != null) ratio = measured
      }
      onStatusRef.current({
        page: page + 1,
        pageCount,
        ratio,
      })
    }

    // Center hit-testing during a CSS page slide still sees the previous
    // column — defer until transform settles so reload/highlights land here.
    const waitForSlide =
      allowMotionRef.current &&
      !!content &&
      !content.classList.contains('no-motion') &&
      !content.classList.contains('is-settling')

    if (!waitForSlide) {
      raf = requestAnimationFrame(report)
      return () => {
        cancelled = true
        cancelAnimationFrame(raf)
      }
    }

    const onEnd = (e: TransitionEvent) => {
      if (e.target !== content) return
      const prop = e.propertyName
      if (prop !== 'transform' && prop !== '-webkit-transform') return
      content.removeEventListener('transitionend', onEnd)
      window.clearTimeout(timer)
      raf = requestAnimationFrame(report)
    }
    content.addEventListener('transitionend', onEnd)
    // --motion-page is 280ms; cover end-event misses (no delta, reduced motion).
    timer = window.setTimeout(() => {
      content.removeEventListener('transitionend', onEnd)
      report()
    }, 400)

    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      window.clearTimeout(timer)
      content.removeEventListener('transitionend', onEnd)
    }
  }, [page, pageCount, pageWidth])

  const go = useCallback((delta: number, instant = false) => {
    const count = pageCountRef.current
    if (instant) setAllowMotion(false)
    setPage((p) => {
      const next = p + delta
      if (next < 0) return 0
      if (next >= count) {
        exhaustedRef.current?.()
        return p
      }
      return next
    })
    if (instant) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setAllowMotion(true))
      })
    }
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

  const onDragOffset = useCallback(
    (offset: number) => {
      dragOffsetRef.current = offset
      paintX()
    },
    [paintX],
  )

  const onDragging = useCallback(
    (next: boolean) => {
      if (!next) dragOffsetRef.current = 0
      setDragging(next)
      // Settling after a swipe: snap transform without waiting for React.
      if (!next) paintX()
    },
    [paintX],
  )

  usePageGestures({
    rootRef: viewportRef,
    clipRef,
    contentRootRef: contentRef,
    pageRef,
    pageCountRef,
    pageWidthRef,
    onGo: go,
    onTapCenter: onToggleChrome,
    onDragOffset,
    onDragging,
  })

  useLayoutEffect(() => {
    // Skip fighting the restore snap until settled; restore effect sets X once.
    // While the finger owns the transform, skip so we do not clobber dragOffset.
    if (!settled && !restored.current) return
    if (dragging) return
    paintX()
  }, [page, pageWidth, settled, dragging, paintX])

  return (
    <div className="paged-viewport" ref={viewportRef}>
      <div className="paged-stage">
        <div className="paged-clip" ref={clipRef}>
          <div
            className={[
              'paged-content',
              dragging ? 'is-dragging' : '',
              settled ? '' : 'is-settling',
              allowMotion ? '' : 'no-motion',
            ]
              .filter(Boolean)
              .join(' ')}
            ref={contentRef}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
