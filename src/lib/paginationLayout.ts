import { pageCountFor } from './reading'

/** Lock a multicol element to one visible page; returns page count. */
export function applyColumnPageSize(
  el: HTMLElement,
  width: number,
  height: number,
): number {
  const w = Math.max(1, Math.floor(width))
  const h = Math.max(1, Math.floor(height))

  el.style.boxSizing = 'border-box'
  el.style.margin = '0'
  el.style.padding = '0'
  el.style.border = '0'
  el.style.height = `${h}px`
  // Visible box = one page; extra columns overflow horizontally.
  el.style.width = `${w}px`
  el.style.columnWidth = `${w}px`
  el.style.columnGap = '0px'
  el.style.columnFill = 'auto'
  el.style.columnRule = 'none'
  // Older WebKit (Kindle/Silk) needs -webkit-column-*
  const webkit = el.style as CSSStyleDeclaration & {
    webkitColumnWidth?: string
    webkitColumnGap?: string
    webkitColumnFill?: string
    webkitColumnRule?: string
  }
  webkit.webkitColumnWidth = `${w}px`
  webkit.webkitColumnGap = '0px'
  webkit.webkitColumnFill = 'auto'
  webkit.webkitColumnRule = 'none'

  void el.offsetWidth
  return pageCountFor(el.scrollWidth, w)
}
