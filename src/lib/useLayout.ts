import { useEffect, useState } from 'react'
import {
  LAYOUTS,
  loadLayout,
  setLayout as persistLayout,
  type LayoutId,
} from './prefs'

export function useLayout() {
  const [layout, setLayoutState] = useState<LayoutId>(() => loadLayout())

  useEffect(() => {
    document.documentElement.dataset.layout = layout
  }, [layout])

  function setLayout(next: LayoutId) {
    setLayoutState(next)
    persistLayout(next)
  }

  return [layout, setLayout, LAYOUTS] as const
}
