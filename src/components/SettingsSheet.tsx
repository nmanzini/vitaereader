import { useEffect, useId } from 'react'
import { ThemePicker } from './ThemePicker'
import {
  LAYOUTS,
  type LayoutId,
  type ThemeId,
} from '../lib/prefs'
import './SettingsSheet.css'

type Props = {
  open: boolean
  onClose: () => void
  theme: ThemeId
  onTheme: (theme: ThemeId) => void
  layout: LayoutId
  onLayout: (layout: LayoutId) => void
}

export function SettingsSheet({
  open,
  onClose,
  theme,
  onTheme,
  layout,
  onLayout,
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

        <section className="settings-section">
          <h3>Layout</h3>
          <div className="settings-segment" role="group" aria-label="Layout">
            {LAYOUTS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={layout === item.id ? 'is-active' : undefined}
                onClick={() => onLayout(item.id)}
                aria-pressed={layout === item.id}
              >
                <span className="settings-segment-label">{item.label}</span>
                <span className="settings-segment-hint">{item.hint}</span>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
