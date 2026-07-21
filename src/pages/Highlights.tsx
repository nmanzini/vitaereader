import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ShareSheet,
  type ShareSheetPayload,
} from '../components/ShareSheet'
import { loadIndex, type CorpusIndex } from '../lib/corpus'
import {
  flattenHighlights,
  groupHighlightsByBook,
  sortHighlightsRecent,
  type HighlightEntry,
} from '../lib/highlightsList'
import { worksInLibraryOrder } from '../lib/libraryOrder'
import {
  loadHighlights,
  removeHighlight,
  type HighlightsMap,
} from '../lib/prefs'
import './Highlights.css'

type SortMode = 'recent' | 'book'

function excerpt(text: string, max = 140): string {
  const t = text.replace(/\s+/g, ' ').trim()
  if (t.length <= max) return t
  return `${t.slice(0, max - 1).trimEnd()}…`
}

function HighlightRow({
  entry,
  onShare,
  onDelete,
}: {
  entry: HighlightEntry
  onShare: (entry: HighlightEntry) => void
  onDelete: (entry: HighlightEntry) => void
}) {
  return (
    <li className="hl-item">
      <Link
        to={`/read/${entry.workId}?p=${encodeURIComponent(entry.paraId)}`}
        className="hl-row"
      >
        <p className="hl-quote">“{excerpt(entry.text)}”</p>
        <p className="hl-meta">{entry.workTitle}</p>
      </Link>
      <div className="hl-actions" role="group" aria-label="Highlight actions">
        <button
          type="button"
          className="hl-action"
          onClick={() => onShare(entry)}
        >
          Share
        </button>
        <button
          type="button"
          className="hl-action"
          onClick={() => onDelete(entry)}
        >
          Delete
        </button>
      </div>
    </li>
  )
}

export function Highlights() {
  const [index, setIndex] = useState<CorpusIndex | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sort, setSort] = useState<SortMode>('recent')
  const [map, setMap] = useState<HighlightsMap>(() => loadHighlights())
  const [sharePayload, setSharePayload] = useState<ShareSheetPayload | null>(
    null,
  )

  useEffect(() => {
    loadIndex()
      .then(setIndex)
      .catch((e: Error) => setError(e.message))
  }, [])

  const titleById = useMemo(() => {
    const m = new Map<string, string>()
    if (!index) return m
    for (const w of worksInLibraryOrder(index)) m.set(w.id, w.title)
    return m
  }, [index])

  const rows = useMemo(
    () => flattenHighlights(map, titleById),
    [map, titleById],
  )

  const recent = useMemo(() => sortHighlightsRecent(rows), [rows])

  const byBook = useMemo(() => {
    if (!index) return []
    const order = worksInLibraryOrder(index).map((w) => w.id)
    return groupHighlightsByBook(rows, order)
  }, [rows, index])

  const count = rows.length

  function onShare(entry: HighlightEntry) {
    setSharePayload({
      quote: entry.text,
      workTitle: entry.workTitle,
      workId: entry.workId,
      paraId: entry.paraId,
    })
  }

  function onDelete(entry: HighlightEntry) {
    if (!removeHighlight(entry.workId, entry.id)) return
    setMap(loadHighlights())
  }

  return (
    <main className="highlights-page">
      <header className="highlights-hero">
        <p className="highlights-back">
          <Link to="/">Library</Link>
        </p>
        <h1>Highlights</h1>
        <p className="highlights-lede">
          Passages you’ve marked while reading.
        </p>
        {count > 0 ? (
          <div
            className="highlights-sort"
            role="group"
            aria-label="Sort highlights"
          >
            <button
              type="button"
              className={
                sort === 'recent'
                  ? 'highlights-sort-btn is-active'
                  : 'highlights-sort-btn'
              }
              aria-pressed={sort === 'recent'}
              onClick={() => setSort('recent')}
            >
              Recent
            </button>
            <button
              type="button"
              className={
                sort === 'book'
                  ? 'highlights-sort-btn is-active'
                  : 'highlights-sort-btn'
              }
              aria-pressed={sort === 'book'}
              onClick={() => setSort('book')}
            >
              By book
            </button>
          </div>
        ) : null}
      </header>

      {error ? <p className="highlights-empty">{error}</p> : null}

      {!error && count === 0 ? (
        <p className="highlights-empty">
          No highlights yet. Select a passage while reading, then choose
          Highlight.
        </p>
      ) : null}

      {!error && count > 0 && sort === 'recent' ? (
        <ul className="hl-list">
          {recent.map((entry) => (
            <HighlightRow
              key={`${entry.workId}:${entry.id}`}
              entry={entry}
              onShare={onShare}
              onDelete={onDelete}
            />
          ))}
        </ul>
      ) : null}

      {!error && count > 0 && sort === 'book' ? (
        <div className="hl-groups">
          {byBook.map((group) => (
            <section
              key={group.workId}
              className="hl-group"
              aria-labelledby={`hl-book-${group.workId}`}
            >
              <h2 id={`hl-book-${group.workId}`} className="hl-group-title">
                {group.workTitle}
              </h2>
              <ul className="hl-list">
                {group.highlights.map((entry) => (
                  <HighlightRow
                    key={`${entry.workId}:${entry.id}`}
                    entry={entry}
                    onShare={onShare}
                    onDelete={onDelete}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : null}

      <ShareSheet
        open={sharePayload != null}
        payload={sharePayload}
        onClose={() => setSharePayload(null)}
      />
    </main>
  )
}
