import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Library } from './pages/Library'
import { Reader } from './pages/Reader'
import { loadTheme, setTheme } from './lib/prefs'

setTheme(loadTheme())

const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || undefined

export default function App() {
  return (
    <BrowserRouter basename={basename}>
      <Routes>
        <Route path="/" element={<Library />} />
        <Route path="/pair/:slug" element={<Navigate to="/" replace />} />
        <Route path="/read/:slug" element={<Reader />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
