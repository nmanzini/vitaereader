import { useState } from 'react'
import { loadTheme, setTheme as persistTheme, type ThemeId } from './prefs'

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeId>(() => loadTheme())

  function setTheme(next: ThemeId) {
    setThemeState(next)
    persistTheme(next)
  }

  return [theme, setTheme] as const
}
