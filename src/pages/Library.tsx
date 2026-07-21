import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { formatWords, loadFinished } from '../lib/prefs'
import { loadIndex, pairWorks, type CorpusIndex } from '../lib/corpus'
import { libraryEntries } from '../lib/libraryOrder'
import { useTheme } from '../lib/useTheme'
import { ThemePicker } from '../components/ThemePicker'
import './Library.css'

export function Library() {
  const [index, setIndex] = useState<CorpusIndex | null>(null)
  const [theme, setTheme] = useTheme()
  const [finished] = useState(() => loadFinished())
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadIndex()
      .then(setIndex)
      .catch((e: Error) => setError(e.message))
  }, [])

  if (error) {
    return (
      <main className="library">
        <p className="library-error">{error}</p>
      </main>
    )
  }

  if (!index) {
    return (
      <main className="library">
        <p className="library-loading">Opening the Lives…</p>
      </main>
    )
  }

  const entries = libraryEntries(index)

  return (
    <main className="library">
      <header className="library-hero">
        <p className="library-brand">Vitae</p>
        <h1>Plutarch’s Parallel Lives</h1>
        <p className="library-lede">
          Dryden’s translation, revised by A. H. Clough. Pairs of Greek and
          Roman lives in order — with the few unpaired lives kept where they
          belong in the sequence.
        </p>
        <ThemePicker theme={theme} onChange={setTheme} />
        <p className="library-meta">
          {index.totals.pairs} pairs · {index.totals.unpaired} unpaired ·{' '}
          {formatWords(index.totals.words)}
        </p>
      </header>

      <section className="library-section" aria-labelledby="lives-heading">
        <h2 id="lives-heading">Lives</h2>
        <ol className="pair-list">
          {entries.map((entry, i) => {
            const num = String(i + 1).padStart(2, '0')
            if (entry.kind === 'pair') {
              const { pair } = entry
              const done = pairWorks(pair).every((w) => finished.has(w.id))
              return (
                <li key={pair.id} className={done ? 'is-finished' : undefined}>
                  <Link to={`/pair/${pair.slug}`} className="pair-card">
                    <span className="pair-num">{num}</span>
                    <span className="pair-body">
                      <span className="pair-title">{pair.title}</span>
                      <span className="pair-sub">
                        {pair.greek.map((g) => g.title).join(' · ')}
                        <span aria-hidden="true"> — </span>
                        {pair.roman.map((r) => r.title).join(' · ')}
                        {pair.comparison ? ' · Comparison' : ''}
                      </span>
                    </span>
                  </Link>
                </li>
              )
            }

            const { work } = entry
            const done = finished.has(work.id)
            const culture =
              work.culture === 'roman'
                ? 'Roman'
                : work.culture === 'greek'
                  ? 'Greek'
                  : 'Unpaired'
            return (
              <li key={work.id} className={done ? 'is-finished' : undefined}>
                <Link to={`/read/${work.id}`} className="pair-card">
                  <span className="pair-num">{num}</span>
                  <span className="pair-body">
                    <span className="pair-title">{work.title}</span>
                    <span className="pair-sub">
                      {culture} · unpaired · {formatWords(work.wordCount)}
                    </span>
                  </span>
                </Link>
              </li>
            )
          })}
        </ol>
      </section>

      <footer className="library-footer">
        <p>
          Source:{' '}
          <a href={index.meta.sourceUrl} target="_blank" rel="noreferrer">
            Project Gutenberg #{index.meta.gutenbergId}
          </a>
          . Public domain.
        </p>
      </footer>
    </main>
  )
}
