import { useCallback, useState } from 'react'
import {
  applyReadingPrefs,
  loadReadingPrefs,
  saveReadingPrefs,
  type ReadingPrefs,
  type TypeFontId,
  type TypeLeadingId,
  type TypeMarginId,
  type TypeSizeId,
  stepTypeSize,
} from './readingPrefs'

export function useReadingPrefs() {
  const [prefs, setPrefsState] = useState<ReadingPrefs>(() => {
    const loaded = loadReadingPrefs()
    applyReadingPrefs(loaded)
    return loaded
  })

  const setPrefs = useCallback((next: ReadingPrefs) => {
    const normalized = { ...next }
    setPrefsState(normalized)
    saveReadingPrefs(normalized)
  }, [])

  const patch = useCallback((partial: Partial<ReadingPrefs>) => {
    setPrefsState((prev) => {
      const next = { ...prev, ...partial }
      saveReadingPrefs(next)
      return next
    })
  }, [])

  const setFont = useCallback((font: TypeFontId) => patch({ font }), [patch])
  const setSize = useCallback((size: TypeSizeId) => patch({ size }), [patch])
  const setLeading = useCallback(
    (leading: TypeLeadingId) => patch({ leading }),
    [patch],
  )
  const setMargin = useCallback(
    (margin: TypeMarginId) => patch({ margin }),
    [patch],
  )
  const nudgeSize = useCallback((delta: -1 | 1) => {
    setPrefsState((prev) => {
      const next = { ...prev, size: stepTypeSize(prev.size, delta) }
      saveReadingPrefs(next)
      return next
    })
  }, [])

  return {
    prefs,
    setPrefs,
    setFont,
    setSize,
    setLeading,
    setMargin,
    nudgeSize,
  }
}
