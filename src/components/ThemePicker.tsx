import { THEMES, type ThemeId } from '../lib/prefs'

type Props = {
  theme: ThemeId
  onChange: (theme: ThemeId) => void
  compact?: boolean
}

export function ThemePicker({ theme, onChange, compact = false }: Props) {
  return (
    <div
      className={compact ? 'theme-mini' : 'theme-row'}
      role="group"
      aria-label="Color"
    >
      {THEMES.map((t) => (
        <button
          key={t.id}
          type="button"
          className={theme === t.id ? 'is-active' : undefined}
          onClick={() => onChange(t.id)}
          title={compact ? t.label : undefined}
        >
          {compact ? t.label[0] : t.label}
        </button>
      ))}
    </div>
  )
}
