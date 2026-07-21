import { useEffect, type RefObject } from 'react'
import { hasTextSelection } from './selectionOffsets'

type Opts = {
  rootRef: RefObject<HTMLElement | null>
  pageRef: RefObject<number>
  pageCountRef: RefObject<number>
  pageWidthRef: RefObject<number>
  onGo: (delta: number) => void
  onTapCenter: () => void
  onDragOffset: (offset: number) => void
  onDragging: (dragging: boolean) => void
}

type Point = { x: number; y: number; id: number }

function pointFromTouch(t: Touch): Point {
  return { x: t.clientX, y: t.clientY, id: t.identifier }
}

function pointFromPointer(e: PointerEvent): Point {
  return { x: e.clientX, y: e.clientY, id: e.pointerId }
}

/**
 * Pointer drag / tap zones for page turns.
 * Falls back to touch events when PointerEvent is missing (older Kindle/WebKit).
 */
export function usePageGestures({
  rootRef,
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

    let startX = 0
    let startY = 0
    let active = false
    let didDrag = false
    let pointerId: number | null = null
    let captured = false
    const usePointer = typeof window.PointerEvent === 'function'

    function releaseCapture(id: number) {
      if (!captured || !usePointer) return
      try {
        root.releasePointerCapture(id)
      } catch {
        /* already released */
      }
      captured = false
    }

    function onDown(p: Point, target: EventTarget | null) {
      const el = target as Element | null
      if (el && el.closest && el.closest('a, button, .selection-toolbar')) return
      if (hasTextSelection()) return
      active = true
      didDrag = false
      pointerId = p.id
      startX = p.x
      startY = p.y
    }

    function onMove(p: Point) {
      if (!active || p.id !== pointerId) return
      if (hasTextSelection()) {
        active = false
        releaseCapture(p.id)
        onDragging(false)
        onDragOffset(0)
        return
      }

      const dx = p.x - startX
      const dy = p.y - startY

      if (!didDrag) {
        if (Math.abs(dx) < 10) return
        if (Math.abs(dx) < Math.abs(dy)) {
          active = false
          onDragging(false)
          onDragOffset(0)
          return
        }
        didDrag = true
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

      const page = pageRef.current
      const count = pageCountRef.current
      let offset = dx
      if ((page <= 0 && dx > 0) || (page >= count - 1 && dx < 0)) {
        offset = dx * 0.28
      }
      onDragOffset(offset)
    }

    function finish(p: Point) {
      if (!active || p.id !== pointerId) return
      active = false
      pointerId = null
      releaseCapture(p.id)

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

      if (didDrag) {
        if (dx <= -threshold) onGo(1)
        else if (dx >= threshold) onGo(-1)
        return
      }

      if (Math.abs(dx) > 12 || Math.abs(dy) > 12) return
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
      if (!active || e.touches.length !== 1) return
      const t = e.touches[0]!
      if (didDrag) e.preventDefault()
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
      root.removeEventListener('touchstart', onTouchStart)
      root.removeEventListener('touchmove', onTouchMove)
      root.removeEventListener('touchend', onTouchEnd)
      root.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [
    rootRef,
    pageRef,
    pageCountRef,
    pageWidthRef,
    onGo,
    onTapCenter,
    onDragOffset,
    onDragging,
  ])
}
