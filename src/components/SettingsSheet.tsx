import { useEffect, useId } from 'react'
import { ThemePicker } from './ThemePicker'
import { type ThemeId } from '../lib/prefs'
import './SettingsSheet.css'

type Props = {
  open: boolean
  onClose: () => void
  theme: ThemeId
  onTheme: (theme: ThemeId) => void
}

export function SettingsSheet({
  open,
  onClose,
  theme,
  onTheme,
}: Props) {
  const titleId = useId()

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="settings-backdrop" onClick={onClose}>
      <div
        className="settings-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="settings-header">
          <h2 id={titleId}>Settings</h2>
          <button type="button" className="settings-close" onClick={onClose}>
            Done
          </button>
        </header>

        <section className="settings-section">
          <h3>Appearance</h3>
          <ThemePicker theme={theme} onChange={onTheme} />
        </section>
      </div>
    </div>
  )
}
