import { useEffect, type RefObject } from 'react'
import { hasTextSelection } from './selectionOffsets'

type Opts = {
  /** Full-bleed hit area (includes left/right margins outside the measure). */
  rootRef: RefObject<HTMLElement | null>
  /** Visible page clip — used for selection edge auto-advance. */
  clipRef: RefObject<HTMLElement | null>
  pageRef: RefObject<number>
  pageCountRef: RefObject<number>
  pageWidthRef: RefObject<number>
  onGo: (delta: number, instant?: boolean) => void
  onTapCenter: () => void
  onDragOffset: (offset: number) => void
  onDragging: (dragging: boolean) => void
}

type Point = { x: number; y: number; id: number }

type Mode = 'idle' | 'pending' | 'paging' | 'selecting'

const TAP_SLOP = 12
const PAGE_DRAG_SLOP = 14
/** Harder to steal a text drag into a page swipe (Silk/mobile). */
const TEXT_PAGE_DRAG_SLOP = 52
const LONG_PRESS_MS = 380
const EDGE_ZONE_PX = 36
const EDGE_ADVANCE_MS = 420

function pointFromTouch(t: Touch): Point {
  return { x: t.clientX, y: t.clientY, id: t.identifier }
}

function pointFromPointer(e: PointerEvent): Point {
  return { x: e.clientX, y: e.clientY, id: e.pointerId }
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  const el = target as Element | null
  return !!(el && el.closest && el.closest('a, button, .selection-toolbar'))
}

/** True when the press likely intends to select body text. */
function isTextualTarget(target: EventTarget | null): boolean {
  const el = target as Element | null
  if (!el || !el.closest) return false
  return !!el.closest(
    '.paged-content, .reader-body, .reader-header, .p-prose, .p-noindent, .p-poem, p, h1, h2, h3',
  )
}

/**
 * Pointer drag / tap zones for page turns.
 * Distinguishes text-selection intent from page swipes; falls back to touch
 * events when PointerEvent is missing (older Kindle/WebKit).
 */
export function usePageGestures({
  rootRef,
  clipRef,
  pageRef,
  pageCountRef,
  pageWidthRef,
  onGo,
  onTapCenter,
  onDragOffset,
  onDragging,
}: Opts) {
  useEffect(() => {
    const current = rootRef.current
    if (!current) return
    const root: HTMLElement = current

    let mode: Mode = 'idle'
    let startX = 0
    let startY = 0
    let pointerId: number | null = null
    let captured = false
    let startedOnText = false
    let longPressTimer: number | null = null
    let edgeTimer: number | null = null
    let lastEdgeAt = 0
    const usePointer = typeof window.PointerEvent === 'function'

    function clearLongPress() {
      if (longPressTimer != null) {
        window.clearTimeout(longPressTimer)
        longPressTimer = null
      }
    }

    function clearEdge() {
      if (edgeTimer != null) {
        window.clearTimeout(edgeTimer)
        edgeTimer = null
      }
    }

    function releaseCapture(id: number) {
      if (!captured || !usePointer) return
      try {
        root.releasePointerCapture(id)
      } catch {
        /* already released */
      }
      captured = false
    }

    function enterSelecting() {
      clearLongPress()
      if (mode === 'paging') {
        onDragging(false)
        onDragOffset(0)
        if (pointerId != null) releaseCapture(pointerId)
      }
      mode = 'selecting'
    }

    function maybeEdgeAdvance(clientX: number) {
      if (mode !== 'selecting' && !hasTextSelection()) return
      const clip = clipRef.current
      if (!clip) return
      const rect = clip.getBoundingClientRect()
      const now = Date.now()
      if (now - lastEdgeAt < EDGE_ADVANCE_MS) return

      let delta = 0
      if (clientX >= rect.right - EDGE_ZONE_PX) delta = 1
      else if (clientX <= rect.left + EDGE_ZONE_PX) delta = -1
      else return

      const page = pageRef.current
      const count = pageCountRef.current
      if (delta > 0 && page >= count - 1) return
      if (delta < 0 && page <= 0) return

      lastEdgeAt = now
      // Instant column step so the native selection can continue across pages.
      onGo(delta, true)
    }

    function onDown(p: Point, target: EventTarget | null) {
      if (isInteractiveTarget(target)) return
      // Existing selection: let the user extend / drag handles — never pan.
      if (hasTextSelection()) {
        mode = 'selecting'
        pointerId = p.id
        startX = p.x
        startY = p.y
        startedOnText = true
        return
      }

      mode = 'pending'
      pointerId = p.id
      startX = p.x
      startY = p.y
      startedOnText = isTextualTarget(target)
      clearLongPress()
      // Long-press on text locks selection mode (Kindle-like).
      if (startedOnText) {
        longPressTimer = window.setTimeout(() => {
          longPressTimer = null
          if (mode === 'pending') enterSelecting()
        }, LONG_PRESS_MS)
      }
    }

    function onMove(p: Point) {
      if (mode === 'idle' || p.id !== pointerId) return

      if (mode === 'selecting') {
        maybeEdgeAdvance(p.x)
        return
      }

      if (hasTextSelection()) {
        enterSelecting()
        maybeEdgeAdvance(p.x)
        return
      }

      const dx = p.x - startX
      const dy = p.y - startY
      const absX = Math.abs(dx)
      const absY = Math.abs(dy)

      if (mode === 'pending') {
        // Vertical-ish move on text → native selection, not a page swipe.
        if (startedOnText && absY > 10 && absY >= absX) {
          enterSelecting()
          return
        }

        const slop = startedOnText ? TEXT_PAGE_DRAG_SLOP : PAGE_DRAG_SLOP
        if (absX < slop) return
        if (absX < absY) {
          // Not a horizontal page gesture.
          if (startedOnText) enterSelecting()
          else {
            mode = 'idle'
            clearLongPress()
          }
          return
        }

        // Confirmed page swipe — only now steal the gesture.
        clearLongPress()
        mode = 'paging'
        onDragging(true)
        if (usePointer) {
          try {
            root.setPointerCapture(p.id)
            captured = true
          } catch {
            captured = false
          }
        }
      }

      if (mode !== 'paging') return

      const page = pageRef.current
      const count = pageCountRef.current
      let offset = dx
      if ((page <= 0 && dx > 0) || (page >= count - 1 && dx < 0)) {
        offset = dx * 0.28
      }
      onDragOffset(offset)
    }

    function finish(p: Point) {
      if (mode === 'idle' || p.id !== pointerId) return
      const was = mode
      mode = 'idle'
      pointerId = null
      clearLongPress()
      clearEdge()
      releaseCapture(p.id)

      if (was === 'selecting') {
        onDragging(false)
        onDragOffset(0)
        return
      }

      if (hasTextSelection()) {
        onDragging(false)
        onDragOffset(0)
        return
      }

      const dx = p.x - startX
      const dy = p.y - startY
      const width = pageWidthRef.current || root.clientWidth
      const threshold = Math.min(64, width * 0.18)

      onDragging(false)
      onDragOffset(0)

      if (was === 'paging') {
        if (dx <= -threshold) onGo(1)
        else if (dx >= threshold) onGo(-1)
        return
      }

      // Tap — zones relative to full root (margins outside measure are live).
      if (Math.abs(dx) > TAP_SLOP || Math.abs(dy) > TAP_SLOP) return
      const rect = root.getBoundingClientRect()
      const x = p.x - rect.left
      const third = rect.width / 3
      if (x < third) onGo(-1)
      else if (x > third * 2) onGo(1)
      else onTapCenter()
    }

    if (usePointer) {
      function onPointerDown(e: PointerEvent) {
        if (e.button !== 0) return
        onDown(pointFromPointer(e), e.target)
      }
      function onPointerMove(e: PointerEvent) {
        onMove(pointFromPointer(e))
      }
      function onPointerUp(e: PointerEvent) {
        finish(pointFromPointer(e))
      }
      root.addEventListener('pointerdown', onPointerDown)
      root.addEventListener('pointermove', onPointerMove)
      root.addEventListener('pointerup', onPointerUp)
      root.addEventListener('pointercancel', onPointerUp)
      return () => {
        clearLongPress()
        clearEdge()
        root.removeEventListener('pointerdown', onPointerDown)
        root.removeEventListener('pointermove', onPointerMove)
        root.removeEventListener('pointerup', onPointerUp)
        root.removeEventListener('pointercancel', onPointerUp)
      }
    }

    function onTouchStart(e: TouchEvent) {
      if (e.touches.length !== 1) return
      onDown(pointFromTouch(e.touches[0]!), e.target)
    }
    function onTouchMove(e: TouchEvent) {
      if (mode === 'idle' || e.touches.length !== 1) return
      const t = e.touches[0]!
      // Only block native scrolling once we own a page swipe — never during select.
      if (mode === 'paging') e.preventDefault()
      onMove(pointFromTouch(t))
    }
    function onTouchEnd(e: TouchEvent) {
      const t = e.changedTouches[0]
      if (!t) return
      finish(pointFromTouch(t))
    }

    root.addEventListener('touchstart', onTouchStart, { passive: true })
    root.addEventListener('touchmove', onTouchMove, { passive: false })
    root.addEventListener('touchend', onTouchEnd)
    root.addEventListener('touchcancel', onTouchEnd)
    return () => {
      clearLongPress()
      clearEdge()
      root.removeEventListener('touchstart', onTouchStart)
      root.removeEventListener('touchmove', onTouchMove)
      root.removeEventListener('touchend', onTouchEnd)
      root.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [
    rootRef,
    clipRef,
    pageRef,
    pageCountRef,
    pageWidthRef,
    onGo,
    onTapCenter,
    onDragOffset,
    onDragging,
  ])
}
