import { useCallback, useEffect, useRef } from 'react'
import { useTimedFlag } from './useTimedFlag'

/**
 * Overlay chrome over reserved blank bands.
 * Showing/hiding never changes layout — spacers always keep the space.
 */
export function useReaderChrome(settingsOpen: boolean) {
  const {
    on: topOn,
    setOn: setTopOn,
    reveal: revealTop,
    scheduleHide: scheduleTopHide,
    clear: clearTop,
  } = useTimedFlag(false)
  const {
    on: bottomOn,
    setOn: setBottomOn,
    reveal: revealBottom,
    scheduleHide: scheduleBottomHide,
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

  const scheduleHideTop = useCallback(() => {
    scheduleTopHide(700, settingsOpen)
  }, [scheduleTopHide, settingsOpen])

  const scheduleHideBottom = useCallback(() => {
    scheduleBottomHide(700)
  }, [scheduleBottomHide])

  const toggleChrome = useCallback(() => {
    const next = !topOnRef.current
    setTopOn(next)
    setBottomOn(next)
  }, [setTopOn, setBottomOn])

  return {
    topOpen: topOn || settingsOpen,
    bottomOpen: bottomOn,
    revealTop,
    scheduleHideTop,
    revealBottom,
    scheduleHideBottom,
    toggleChrome,
  }
}
