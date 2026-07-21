import { useCallback, useEffect, useRef, useState } from 'react'

/** Boolean that can auto-hide after a delay. */
export function useTimedFlag(init = false) {
  const [on, setOn] = useState(init)
  const timer = useRef<number | null>(null)

  const clear = useCallback(() => {
    if (timer.current) {
      window.clearTimeout(timer.current)
      timer.current = null
    }
  }, [])

  useEffect(() => () => clear(), [clear])

  const reveal = useCallback(() => {
    clear()
    setOn(true)
  }, [clear])

  const scheduleHide = useCallback(
    (ms: number, blocked = false) => {
      if (blocked) return
      clear()
      timer.current = window.setTimeout(() => setOn(false), ms)
    },
    [clear],
  )

  return { on, setOn, reveal, scheduleHide, clear }
}
