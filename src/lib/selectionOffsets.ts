/**
 * Map a DOM Selection to plain-text offsets inside a `[data-para-id]` paragraph.
 * `<br>` counts as `\n` so poem offsets match `paragraph.text`.
 */

export type ParaSelection = {
  paraId: string
  paraEl: HTMLElement
  start: number
  end: number
  text: string
}

/** Plain length of a subtree (BR → 1). */
export function plainTextLength(root: Node): number {
  if (root.nodeType === Node.TEXT_NODE) return root.textContent?.length ?? 0
  if (root.nodeType !== Node.ELEMENT_NODE) return 0
  const el = root as Element
  if (el.tagName === 'BR') return 1
  let n = 0
  for (const child of root.childNodes) n += plainTextLength(child)
  return n
}

/**
 * Offset of (node, offset) in root’s plain text, counting BR as `\n`.
 * For Element containers, `offset` is a child index (DOM Range rules).
 */
export function plainOffsetInElement(
  root: Element,
  node: Node,
  offset: number,
): number | null {
  if (!root.contains(node) && node !== root) return null

  let count = 0
  let found = false

  function walk(current: Node): void {
    if (found) return

    if (current === node) {
      if (current.nodeType === Node.TEXT_NODE) {
        count += Math.min(offset, current.textContent?.length ?? 0)
        found = true
        return
      }
      if (current.nodeType === Node.ELEMENT_NODE) {
        const kids = current.childNodes
        const lim = Math.min(offset, kids.length)
        for (let i = 0; i < lim; i++) count += plainTextLength(kids[i]!)
        found = true
        return
      }
    }

    if (current.nodeType === Node.TEXT_NODE) {
      count += current.textContent?.length ?? 0
      return
    }
    if (current.nodeType === Node.ELEMENT_NODE) {
      const el = current as Element
      if (el.tagName === 'BR') {
        count += 1
        return
      }
      for (const child of current.childNodes) {
        walk(child)
        if (found) return
      }
    }
  }

  walk(root)
  return found ? count : null
}

/** Resolve the current selection if it lies entirely within one reader paragraph. */
export function selectionInParagraph(
  root: ParentNode | null = document,
): ParaSelection | null {
  const sel = window.getSelection()
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null

  const range = sel.getRangeAt(0)
  if (!range || range.collapsed) return null

  const startEl =
    range.startContainer.nodeType === Node.ELEMENT_NODE
      ? (range.startContainer as Element)
      : range.startContainer.parentElement
  const endEl =
    range.endContainer.nodeType === Node.ELEMENT_NODE
      ? (range.endContainer as Element)
      : range.endContainer.parentElement
  if (!startEl || !endEl) return null

  const startPara = startEl.closest('[data-para-id]') as HTMLElement | null
  const endPara = endEl.closest('[data-para-id]') as HTMLElement | null
  if (!startPara || !endPara || startPara !== endPara) return null
  if (root instanceof Element && !root.contains(startPara)) return null

  const paraId = startPara.getAttribute('data-para-id')
  if (!paraId) return null

  const start = plainOffsetInElement(
    startPara,
    range.startContainer,
    range.startOffset,
  )
  const end = plainOffsetInElement(
    startPara,
    range.endContainer,
    range.endOffset,
  )
  if (start == null || end == null || end <= start) return null

  // Prefer source text via toString(); fall back to reconstructed slice.
  const selected = range.toString()
  const text = selected || ''
  if (!text.trim()) return null

  return { paraId, paraEl: startPara, start, end, text }
}

/** Client rect for positioning a selection toolbar (prefer last line). */
export function selectionToolbarAnchor(): DOMRect | null {
  const sel = window.getSelection()
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null
  const range = sel.getRangeAt(0)
  const rects = range.getClientRects()
  if (rects.length > 0) {
    const last = rects[rects.length - 1]!
    if (last.width > 0 || last.height > 0) return last
  }
  const box = range.getBoundingClientRect()
  if (box.width === 0 && box.height === 0) return null
  return box
}

export function clearWindowSelection() {
  const sel = window.getSelection()
  sel?.removeAllRanges()
}

/** True when the user has a non-collapsed text selection. */
export function hasTextSelection(): boolean {
  const sel = window.getSelection()
  return !!sel && !sel.isCollapsed && (sel.toString().length ?? 0) > 0
}
