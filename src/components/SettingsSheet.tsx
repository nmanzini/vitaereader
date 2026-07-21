import { useEffect, useId } from 'react'
import { ThemePicker } from './ThemePicker'
import { type ThemeId } from '../lib/prefs'
import {
  TYPE_FONTS,
  TYPE_LEADINGS,
  TYPE_MARGINS,
  TYPE_SIZES,
  type ReadingPrefs,
  type TypeFontId,
  type TypeLeadingId,
  type TypeMarginId,
} from '../lib/readingPrefs'
import './SettingsSheet.css'

type Props = {
  open: boolean
  onClose: () => void
  theme: ThemeId
  onTheme: (theme: ThemeId) => void
  reading: ReadingPrefs
  onFont: (font: TypeFontId) => void
  onSizeNudge: (delta: -1 | 1) => void
  onLeading: (leading: TypeLeadingId) => void
  onMargin: (margin: TypeMarginId) => void
}

/**
 * Kindle-like Aa sheet: font, size, spacing, margins, then color.
 * Type metrics remasure pages; color themes do not.
 */
export function SettingsSheet({
  open,
  onClose,
  theme,
  onTheme,
  reading,
  onFont,
  onSizeNudge,
  onLeading,
  onMargin,
}: Props) {
  const titleId = useId()
  const sizeIndex = TYPE_SIZES.indexOf(reading.size)

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
          <h2 id={titleId}>Aa</h2>
          <button type="button" className="settings-close" onClick={onClose}>
            Done
          </button>
        </header>

        <section className="settings-section">
          <h3>Font</h3>
          <div className="settings-chip-row" role="group" aria-label="Font">
            {TYPE_FONTS.map((f) => (
              <button
                key={f.id}
                type="button"
                data-font={f.id}
                className={
                  reading.font === f.id
                    ? 'settings-chip is-active'
                    : 'settings-chip'
                }
                onClick={() => onFont(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </section>

        <section className="settings-section">
          <h3>Size</h3>
          <div className="settings-size-row" role="group" aria-label="Font size">
            <button
              type="button"
              className="settings-size-btn"
              aria-label="Smaller"
              disabled={sizeIndex <= 0}
              onClick={() => onSizeNudge(-1)}
            >
              A−
            </button>
            <div
              className="settings-size-dots"
              aria-valuetext={reading.size}
              aria-valuenow={sizeIndex + 1}
              aria-valuemin={1}
              aria-valuemax={TYPE_SIZES.length}
              role="meter"
            >
              {TYPE_SIZES.map((id) => (
                <span
                  key={id}
                  className={
                    id === reading.size
                      ? 'settings-size-dot is-active'
                      : 'settings-size-dot'
                  }
                />
              ))}
            </div>
            <button
              type="button"
              className="settings-size-btn"
              aria-label="Larger"
              disabled={sizeIndex >= TYPE_SIZES.length - 1}
              onClick={() => onSizeNudge(1)}
            >
              A+
            </button>
          </div>
        </section>

        <section className="settings-section">
          <h3>Spacing</h3>
          <div className="settings-chip-row" role="group" aria-label="Line spacing">
            {TYPE_LEADINGS.map((l) => (
              <button
                key={l.id}
                type="button"
                className={
                  reading.leading === l.id
                    ? 'settings-chip is-active'
                    : 'settings-chip'
                }
                onClick={() => onLeading(l.id)}
              >
                {l.label}
              </button>
            ))}
          </div>
        </section>

        <section className="settings-section">
          <h3>Margins</h3>
          <div className="settings-chip-row" role="group" aria-label="Margins">
            {TYPE_MARGINS.map((m) => (
              <button
                key={m.id}
                type="button"
                className={
                  reading.margin === m.id
                    ? 'settings-chip is-active'
                    : 'settings-chip'
                }
                onClick={() => onMargin(m.id)}
              >
                {m.label}
              </button>
            ))}
          </div>
        </section>

        <section className="settings-section">
          <h3>Color</h3>
          <ThemePicker theme={theme} onChange={onTheme} />
        </section>
      </div>
    </div>
  )
}
