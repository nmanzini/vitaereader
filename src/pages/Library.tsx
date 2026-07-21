import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { formatWords, loadFinished } from '../lib/prefs'
import {
  loadIndex,
  pairWorks,
  type CorpusIndex,
  type IndexWorkRef,
} from '../lib/corpus'
import { libraryEntries } from '../lib/libraryOrder'
import { useTheme } from '../lib/useTheme'
import { ThemePicker } from '../components/ThemePicker'
import './Library.css'

function WorkLink({
  work,
  label,
  finished,
}: {
  work: IndexWorkRef
  label: string
  finished: boolean
}) {
  return (
    <Link
      to={`/read/${work.id}`}
      className={finished ? 'life-link is-finished' : 'life-link'}
    >
      {label}
    </Link>
  )
}

function LifeLinks({
  items,
  finished,
}: {
  items: { work: IndexWorkRef; label: string }[]
  finished: Set<string>
}) {
  return (
    <div className="life-links">
      {items.map(({ work, label }, i) => (
        <span key={work.id} className="life-item">
          {i > 0 ? (
            <span className="life-sep" aria-hidden="true">
              {' '}
              -{' '}
            </span>
          ) : null}
          <WorkLink
            work={work}
            label={label}
            finished={finished.has(work.id)}
          />
        </span>
      ))}
    </div>
  )
}

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
          Dryden’s translation, revised by A. H. Clough.
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
                  <div className="pair-row">
                    <span className="pair-num">{num}</span>
                    <LifeLinks
                      finished={finished}
                      items={[
                        ...pair.greek.map((w) => ({
                          work: w,
                          label: w.title,
                        })),
                        ...pair.roman.map((w) => ({
                          work: w,
                          label: w.title,
                        })),
                        ...(pair.comparison
                          ? [
                              {
                                work: pair.comparison,
                                label: 'Comparison',
                              },
                            ]
                          : []),
                      ]}
                    />
                  </div>
                </li>
              )
            }

            const { work } = entry
            return (
              <li
                key={work.id}
                className={finished.has(work.id) ? 'is-finished' : undefined}
              >
                <div className="pair-row">
                  <span className="pair-num">{num}</span>
                  <LifeLinks
                    finished={finished}
                    items={[{ work, label: work.title }]}
                  />
                </div>
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
