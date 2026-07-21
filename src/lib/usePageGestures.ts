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

/** Pointer drag / tap zones for Kindle-style page turns. */
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
    // Fresh binding so nested handlers keep a non-null HTMLElement type.
    const root: HTMLElement = current

    let startX = 0
    let startY = 0
    let active = false
    let didDrag = false
    let pointerId: number | null = null
    let captured = false

    function releaseCapture(id: number) {
      if (!captured) return
      try {
        root.releasePointerCapture(id)
      } catch {
        /* already released */
      }
      captured = false
    }

    function onDown(e: PointerEvent) {
      if (e.button !== 0) return
      const target = e.target as Element | null
      if (target?.closest?.('a, button, .selection-toolbar')) return
      // Don’t steal the gesture while a selection is active / being made.
      if (hasTextSelection()) return
      active = true
      didDrag = false
      pointerId = e.pointerId
      startX = e.clientX
      startY = e.clientY
      // Delay capture until a horizontal page-drag is confirmed so long-press
      // text selection can start on touch devices.
    }

    function onMove(e: PointerEvent) {
      if (!active || e.pointerId !== pointerId) return
      if (hasTextSelection()) {
        active = false
        releaseCapture(e.pointerId)
        onDragging(false)
        onDragOffset(0)
        return
      }

      const dx = e.clientX - startX
      const dy = e.clientY - startY

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
        try {
          root.setPointerCapture(e.pointerId)
          captured = true
        } catch {
          captured = false
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

    function finish(e: PointerEvent) {
      if (!active || e.pointerId !== pointerId) return
      active = false
      pointerId = null
      releaseCapture(e.pointerId)

      if (hasTextSelection()) {
        onDragging(false)
        onDragOffset(0)
        return
      }

      const dx = e.clientX - startX
      const dy = e.clientY - startY
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
      const x = e.clientX - rect.left
      const third = rect.width / 3
      if (x < third) onGo(-1)
      else if (x > third * 2) onGo(1)
      else onTapCenter()
    }

    root.addEventListener('pointerdown', onDown)
    root.addEventListener('pointermove', onMove)
    root.addEventListener('pointerup', finish)
    root.addEventListener('pointercancel', finish)
    return () => {
      root.removeEventListener('pointerdown', onDown)
      root.removeEventListener('pointermove', onMove)
      root.removeEventListener('pointerup', finish)
      root.removeEventListener('pointercancel', finish)
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
