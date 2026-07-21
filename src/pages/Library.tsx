import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  formatWords,
  loadFinished,
  loadHighlights,
  loadProgress,
  type ProgressMap,
} from '../lib/prefs'
import {
  loadIndex,
  type CorpusIndex,
  type IndexPair,
  type IndexWorkRef,
} from '../lib/corpus'
import { libraryEntries } from '../lib/libraryOrder'
import { libraryLinkState, struckCharCount } from '../lib/reading'
import { useTheme } from '../lib/useTheme'
import { ThemePicker } from '../components/ThemePicker'
import './Library.css'

type LinkItem = { work: IndexWorkRef; label: string }

function pairLinkItems(pair: IndexPair): LinkItem[] {
  return [
    ...pair.greek.map((w) => ({ work: w, label: w.title })),
    ...pair.roman.map((w) => ({ work: w, label: w.title })),
    ...(pair.comparison
      ? [{ work: pair.comparison, label: 'Comparison' }]
      : []),
  ]
}

function WorkLink({
  work,
  label,
  finished,
  progress,
}: {
  work: IndexWorkRef
  label: string
  finished: boolean
  progress: number
}) {
  const state = libraryLinkState(progress, work.wordCount, finished)
  const className = [
    'life-link',
    state === 'finished' ? 'is-finished' : '',
    state === 'reading' ? 'is-reading' : '',
  ]
    .filter(Boolean)
    .join(' ')

  let body: ReactNode = label
  if (state === 'reading') {
    const n = struckCharCount(label, progress)
    const chars = [...label]
    body = (
      <>
        <span className="life-link-struck">{chars.slice(0, n).join('')}</span>
        {chars.slice(n).join('')}
      </>
    )
  }

  return (
    <Link
      to={`/read/${work.id}`}
      className={className}
      aria-label={
        state === 'finished'
          ? `${label}, finished`
          : state === 'reading'
            ? `${label}, ${Math.round(progress * 100)} percent`
            : undefined
      }
    >
      {body}
    </Link>
  )
}

function LifeLinks({
  items,
  finished,
  progress,
}: {
  items: LinkItem[]
  finished: Set<string>
  progress: ProgressMap
}) {
  return (
    <div className="life-links">
      {items.map(({ work, label }, i) => (
        <span key={work.id} className="life-item">
          {i > 0 ? (
            <span className="life-sep" aria-hidden="true">
              ·
            </span>
          ) : null}
          <WorkLink
            work={work}
            label={label}
            finished={finished.has(work.id)}
            progress={progress[work.id] ?? 0}
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
  const [progress] = useState(() => loadProgress())
  const [highlightCount] = useState(() => {
    const map = loadHighlights()
    let n = 0
    for (const list of Object.values(map)) {
      if (Array.isArray(list)) n += list.length
    }
    return n
  })
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadIndex()
      .then(setIndex)
      .catch((e: Error) => setError(e.message))
  }, [])

  const hero = (
    <header className="library-hero">
      <p className="library-brand">Vitae</p>
      <h1>Plutarch’s Parallel Lives</h1>
      <p className="library-lede">
        Dryden’s translation, revised by A. H. Clough.
      </p>
      <ThemePicker theme={theme} onChange={setTheme} />
      {index ? (
        <p className="library-meta">
          {index.totals.pairs} pairs · {index.totals.unpaired} unpaired ·{' '}
          {formatWords(index.totals.words)}
        </p>
      ) : (
        <p className="library-meta library-meta-skel" aria-hidden="true">
          &nbsp;
        </p>
      )}
    </header>
  )

  if (error) {
    return (
      <main className="library">
        {hero}
        <p className="library-error">{error}</p>
      </main>
    )
  }

  if (!index) {
    return (
      <main className="library">
        {hero}
        <section className="library-section" aria-labelledby="lives-heading">
          <h2 id="lives-heading">Lives</h2>
          <ol className="pair-list" aria-busy="true" aria-label="Loading lives">
            {Array.from({ length: 10 }, (_, i) => (
              <li key={i}>
                <div className="pair-row pair-row-skel">
                  <span className="pair-num">{String(i + 1).padStart(2, '0')}</span>
                  <span className="life-skel" />
                </div>
              </li>
            ))}
          </ol>
        </section>
      </main>
    )
  }

  const entries = libraryEntries(index)

  return (
    <main className="library">
      {hero}

      <section
        className="library-section"
        aria-labelledby="highlights-heading"
      >
        <h2 id="highlights-heading">Highlights</h2>
        <p className="library-highlights-entry">
          <Link to="/highlights" className="library-highlights-link">
            Your marked passages
          </Link>
          {highlightCount > 0 ? (
            <span className="library-highlights-count">
              {' '}
              · {highlightCount}
            </span>
          ) : null}
        </p>
      </section>

      <section className="library-section" aria-labelledby="lives-heading">
        <h2 id="lives-heading">Lives</h2>
        <ol className="pair-list">
          {entries.map((entry, i) => {
            const num = String(i + 1).padStart(2, '0')
            if (entry.kind === 'pair') {
              const { pair } = entry
              return (
                <li key={pair.id}>
                  <div className="pair-row">
                    <span className="pair-num">{num}</span>
                    <LifeLinks
                      finished={finished}
                      progress={progress}
                      items={pairLinkItems(pair)}
                    />
                  </div>
                </li>
              )
            }

            const { work } = entry
            return (
              <li key={work.id}>
                <div className="pair-row">
                  <span className="pair-num">{num}</span>
                  <LifeLinks
                    finished={finished}
                    progress={progress}
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
