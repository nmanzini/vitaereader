import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import {
  isLegacyKindleBrowser,
  pagesEngineSupported,
} from './lib/kindleCompat'
import { loadTheme, setTheme } from './lib/prefs'
import { applyReadingPrefs, loadReadingPrefs } from './lib/readingPrefs'

function showBootFallback() {
  const el = document.getElementById('boot-fallback')
  if (el) {
    el.hidden = false
    el.style.display = 'block'
  }
  const root = document.getElementById('root')
  if (root) root.style.display = 'none'
}

const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''

// Re-apply theme (index.html already set data-theme before paint to avoid FOUC).
try {
  if (/Kindle|Silk/i.test(ua) && !localStorage.getItem('vitae.theme')) {
    setTheme('eink')
  } else {
    setTheme(loadTheme())
  }
  applyReadingPrefs(loadReadingPrefs())
} catch {
  /* private mode / blocked storage */
}

if (isLegacyKindleBrowser(ua) || !pagesEngineSupported()) {
  showBootFallback()
} else {
  const mount = document.getElementById('root')
  if (!mount) {
    showBootFallback()
  } else {
    try {
      createRoot(mount).render(
        <StrictMode>
          <App />
        </StrictMode>,
      )
    } catch {
      showBootFallback()
    }
  }
}
