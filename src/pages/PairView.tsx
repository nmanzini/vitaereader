import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { formatWords } from '../lib/prefs'
import { loadIndex, type IndexPair } from '../lib/corpus'
import './PairView.css'

export function PairView() {
  const { slug } = useParams<{ slug: string }>()
  const [pair, setPair] = useState<IndexPair | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadIndex()
      .then((index) => {
        const found = index.pairs.find((p) => p.slug === slug) ?? null
        if (!found) setError('Pair not found')
        else setPair(found)
      })
      .catch((e: Error) => setError(e.message))
  }, [slug])

  if (error) {
    return (
      <main className="pair-view">
        <p className="pair-view-msg">{error}</p>
        <Link to="/">Back to library</Link>
      </main>
    )
  }

  if (!pair) {
    return (
      <main className="pair-view">
        <p className="pair-view-msg">Loading pair…</p>
      </main>
    )
  }

  return (
    <main className="pair-view">
      <nav className="pair-nav">
        <Link to="/">Library</Link>
      </nav>

      <header className="pair-header">
        <p className="pair-kicker">Pair</p>
        <h1>{pair.title}</h1>
      </header>

      <div className="pair-columns">
        <section>
          <h2>Greek</h2>
          <ul>
            {pair.greek.map((w) => (
              <li key={w.id}>
                <Link to={`/read/${w.id}`}>
                  <span>{w.title}</span>
                  <span className="muted">{formatWords(w.wordCount)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2>Roman</h2>
          <ul>
            {pair.roman.map((w) => (
              <li key={w.id}>
                <Link to={`/read/${w.id}`}>
                  <span>{w.title}</span>
                  <span className="muted">{formatWords(w.wordCount)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {pair.comparison ? (
        <section className="pair-comparison">
          <h2>Comparison</h2>
          <Link to={`/read/${pair.comparison.id}`} className="comparison-link">
            <span>{pair.comparison.title}</span>
            <span className="muted">{formatWords(pair.comparison.wordCount)}</span>
          </Link>
        </section>
      ) : (
        <p className="pair-missing">
          No Comparison survives for this pair in the Clough edition.
        </p>
      )}

      <p className="pair-start">
        <Link to={`/read/${pair.greek[0].id}`}>Begin with {pair.greek[0].title}</Link>
      </p>
    </main>
  )
}
