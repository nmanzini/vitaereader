import { useCallback, useEffect, useRef } from 'react'
import { useTimedFlag } from './useTimedFlag'

/**
 * Overlay chrome over reserved blank bands.
 * Showing/hiding never changes layout — spacers always keep the space.
 * Top and bottom peek together (either band or center tap).
 */
export function useReaderChrome(settingsOpen: boolean) {
  const {
    on: topOn,
    setOn: setTopOn,
    reveal: revealTopOnly,
    scheduleHide: scheduleTopHide,
    clear: clearTop,
  } = useTimedFlag(false)
  const {
    on: bottomOn,
    setOn: setBottomOn,
    reveal: revealBottomOnly,
    scheduleHide: scheduleBottomHide,
    clear: clearBottom,
  } = useTimedFlag(false)

  const topOnRef = useRef(topOn)
  topOnRef.current = topOn

  // Settings sheet needs the top bar visible while open.
  useEffect(() => {
    if (settingsOpen) {
      clearTop()
      setTopOn(true)
    }
  }, [settingsOpen, clearTop, setTopOn])

  const revealChrome = useCallback(() => {
    revealTopOnly()
    revealBottomOnly()
  }, [revealTopOnly, revealBottomOnly])

  const scheduleHideChrome = useCallback(() => {
    // Quiet Kindle: chrome retreats quickly after peek.
    scheduleTopHide(520, settingsOpen)
    scheduleBottomHide(520)
  }, [scheduleTopHide, scheduleBottomHide, settingsOpen])

  /** Dismiss both bars (second tap on an open chrome band). */
  const hideChrome = useCallback(() => {
    if (settingsOpen) return
    clearTop()
    clearBottom()
    setTopOn(false)
    setBottomOn(false)
  }, [settingsOpen, clearTop, clearBottom, setTopOn, setBottomOn])

  /** Center tap — show/hide both together. */
  const toggleChrome = useCallback(() => {
    if (settingsOpen) return
    clearTop()
    clearBottom()
    const next = !topOnRef.current
    setTopOn(next)
    setBottomOn(next)
  }, [settingsOpen, clearTop, clearBottom, setTopOn, setBottomOn])

  return {
    topOpen: topOn || settingsOpen,
    bottomOpen: bottomOn,
    revealChrome,
    hideChrome,
    scheduleHideChrome,
    toggleChrome,
  }
}
