import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Highlights } from './pages/Highlights'
import { Library } from './pages/Library'
import { Reader } from './pages/Reader'

const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || undefined

export default function App() {
  return (
    <BrowserRouter basename={basename}>
      <Routes>
        <Route path="/" element={<Library />} />
        <Route path="/highlights" element={<Highlights />} />
        <Route path="/pair/:slug" element={<Navigate to="/" replace />} />
        <Route path="/read/:slug" element={<Reader />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
