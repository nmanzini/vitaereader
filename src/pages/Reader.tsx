import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import type { Work } from '../content/types'
import {
  findPairForWork,
  loadAnnotations,
  loadIndex,
  loadWork,
  type IndexPair,
} from '../lib/corpus'
import {
  type CharacterAnnotation,
  type WorkAnnotations,
} from '../lib/charMatch'
import {
  addHighlight,
  loadFinished,
  loadHighlightsFor,
  loadProgress,
  removeHighlight,
  saveProgress,
  toggleFinished,
  type TextHighlight,
} from '../lib/prefs'
import {
  buildWordIndex,
  clampRatio,
  measureContentRatio,
  pageIndexForContentRatio,
  ratioFromAnchor,
} from '../lib/contentProgress'
import {
  clearWindowSelection,
  hasTextSelection,
  selectionInParagraph,
  selectionToolbarAnchor,
  type ParaSelection,
} from '../lib/selectionOffsets'
import {
  buildShareText,
  twitterIntentUrl,
  workShareUrl,
} from '../lib/shareQuote'
import {
  findContainingHighlight,
  normalizeRange,
  type HighlightSpan,
} from '../lib/textRanges'
import { formatEta } from '../lib/reading'
import { siblingNav, workKicker } from '../lib/workMeta'
import { useTheme } from '../lib/useTheme'
import { useReaderChrome } from '../lib/useReaderChrome'
import { SettingsSheet } from '../components/SettingsSheet'
import { CharacterSheet } from '../components/CharacterSheet'
import { ParagraphView } from '../components/ParagraphView'
import {
  SelectionToolbar,
  type SelectionToolbarAction,
} from '../components/SelectionToolbar'
import {
  PaginatedReader,
  type PageStatus,
} from '../components/PaginatedReader'
import { GearIcon } from '../components/GearIcon'
import './Reader.css'

/** Deep-link paragraph from `?p=` or `#para-<id>`. */
function paraIdFromLocation(
  search: URLSearchParams,
  hash: string,
): string | null {
  const q = search.get('p')?.trim()
  if (q) return q
  if (hash.startsWith('#para-')) {
    const id = decodeURIComponent(hash.slice('#para-'.length)).trim()
    return id || null
  }
  return null
}

export function Reader() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [work, setWork] = useState<Work | null>(null)
  const [pair, setPair] = useState<IndexPair | null>(null)
  const [annotations, setAnnotations] = useState<WorkAnnotations | null>(null)
  const [activeChar, setActiveChar] = useState<CharacterAnnotation | null>(
    null,
  )
  const [theme, setTheme] = useTheme()
  const [finished, setFinished] = useState(() => loadFinished())
  const [highlights, setHighlights] = useState<TextHighlight[]>([])
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [progress, setProgress] = useState(0)
  /** Content ratio used to resume when work changes. */
  const [resumeAt, setResumeAt] = useState(0)
  const [pageStatus, setPageStatus] = useState<PageStatus>({
    page: 1,
    pageCount: 1,
    ratio: 0,
  })
  const [error, setError] = useState<string | null>(null)
  const [selection, setSelection] = useState<{
    sel: ParaSelection
    anchor: DOMRect
  } | null>(null)

  const {
    topOpen,
    bottomOpen,
    revealTop,
    scheduleHideTop,
    revealBottom,
    scheduleHideBottom,
    toggleChrome,
  } = useReaderChrome(settingsOpen)

  const wordIndex = useMemo(
    () => (work ? buildWordIndex(work.paragraphs) : null),
    [work],
  )

  const highlightsByPara = useMemo(() => {
    const map = new Map<string, HighlightSpan[]>()
    for (const h of highlights) {
      const list = map.get(h.paraId) ?? []
      list.push({ id: h.id, start: h.start, end: h.end })
      map.set(h.paraId, list)
    }
    return map
  }, [highlights])

  const commitProgress = useCallback(
    (ratio: number) => {
      const next = clampRatio(ratio)
      setProgress(next)
      if (slug) saveProgress(slug, next)
    },
    [slug],
  )

  useEffect(() => {
    if (!slug) return
    setWork(null)
    setAnnotations(null)
    setActiveChar(null)
    setSelection(null)
    setHighlights(loadHighlightsFor(slug))
    setError(null)
    const deepPara = paraIdFromLocation(searchParams, window.location.hash)
    Promise.all([loadWork(slug), loadIndex(), loadAnnotations(slug)])
      .then(([w, index, ann]) => {
        setWork(w)
        setPair(findPairForWork(index, slug))
        setAnnotations(ann)
        const saved = clampRatio(loadProgress()[slug] ?? 0)
        const wi = buildWordIndex(w.paragraphs)
        let start = saved
        if (deepPara) {
          const paraIndex = wi.ids.indexOf(deepPara)
          if (paraIndex >= 0) start = ratioFromAnchor(paraIndex, 0, wi)
        }
        setProgress(start)
        setResumeAt(start)
      })
      .catch((e: Error) => setError(e.message))
  }, [slug, searchParams])

  const openCharacter = useCallback(
    (characterId: string) => {
      const hit = annotations?.characters.find((c) => c.id === characterId)
      if (hit) setActiveChar(hit)
    },
    [annotations],
  )

  const refreshSelectionUi = useCallback(() => {
    const shell = document.querySelector('.reader-shell')
    const sel = selectionInParagraph(shell)
    const anchor = selectionToolbarAnchor()
    if (sel && anchor) setSelection({ sel, anchor })
    else setSelection(null)
  }, [])

  useEffect(() => {
    let timer = 0
    function onSelChange() {
      window.clearTimeout(timer)
      // Touch selection settles after a short delay.
      timer = window.setTimeout(refreshSelectionUi, 80)
    }
    document.addEventListener('selectionchange', onSelChange)
    document.addEventListener('mouseup', onSelChange)
    document.addEventListener('touchend', onSelChange)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('selectionchange', onSelChange)
      document.removeEventListener('mouseup', onSelChange)
      document.removeEventListener('touchend', onSelChange)
    }
  }, [refreshSelectionUi])

  const dismissSelection = useCallback(() => {
    clearWindowSelection()
    setSelection(null)
  }, [])

  const onSelectionAction = useCallback(
    (action: SelectionToolbarAction) => {
      if (!selection || !work || !slug) return
      const { sel } = selection
      const para = work.paragraphs.find((p) => p.id === sel.paraId)
      if (!para) return
      const norm = normalizeRange(sel.start, sel.end, para.text.length)
      if (!norm) return
      const quote = para.text.slice(norm.start, norm.end)

      if (action === 'highlight') {
        const created = addHighlight(slug, {
          paraId: sel.paraId,
          start: norm.start,
          end: norm.end,
          text: quote,
        })
        setHighlights((prev) => [...prev, created])
        dismissSelection()
        return
      }
      if (action === 'remove') {
        const hit = findContainingHighlight(
          highlights
            .filter((h) => h.paraId === sel.paraId)
            .map((h) => ({ id: h.id, start: h.start, end: h.end })),
          norm.start,
          norm.end,
        )
        if (hit && removeHighlight(slug, hit.id)) {
          setHighlights((prev) => prev.filter((h) => h.id !== hit.id))
        }
        dismissSelection()
        return
      }
      if (action === 'share') {
        const url = workShareUrl(work.id, sel.paraId)
        const text = buildShareText(work.title, quote, url)
        window.open(twitterIntentUrl(text), '_blank', 'noopener,noreferrer')
        dismissSelection()
        return
      }
      if (action === 'copy') {
        void navigator.clipboard?.writeText(quote)
        dismissSelection()
      }
    },
    [selection, work, slug, highlights, dismissSelection],
  )

  const selectionCanRemove = useMemo(() => {
    if (!selection) return false
    const { sel } = selection
    return (
      findContainingHighlight(
        highlights
          .filter((h) => h.paraId === sel.paraId)
          .map((h) => ({ id: h.id, start: h.start, end: h.end })),
        sel.start,
        sel.end,
      ) != null
    )
  }, [selection, highlights])

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  const measurePageProgress = useCallback(
    (clip: HTMLElement) => {
      if (!wordIndex) return null
      return measureContentRatio(clip, wordIndex)
    },
    [wordIndex],
  )

  const resolvePageIndex = useCallback(
    (content: HTMLElement, pageWidth: number, pageCount: number) => {
      if (!wordIndex) return 0
      return pageIndexForContentRatio(
        content,
        pageWidth,
        pageCount,
        wordIndex,
        resumeAt,
      )
    },
    [wordIndex, resumeAt],
  )

  const onPageStatus = useCallback(
    (status: PageStatus) => {
      setPageStatus(status)
      commitProgress(status.ratio)
    },
    [commitProgress],
  )

  if (error) {
    return (
      <div className="reader-shell">
        <div className="reader-top-spacer" aria-hidden="true" />
        <main className="reader-boot">
          <p className="reader-msg">{error}</p>
          <Link to="/">Library</Link>
        </main>
        <div className="reader-bottom-spacer" aria-hidden="true" />
      </div>
    )
  }

  if (!work) {
    // Same chrome-band shell as reading — no layout jump when work arrives.
    return (
      <div className="reader-shell">
        <div className="reader-top-spacer" aria-hidden="true" />
        <main className="reader-boot" aria-busy="true">
          <p className="reader-msg">Setting the type…</p>
        </main>
        <div className="reader-bottom-spacer" aria-hidden="true" />
      </div>
    )
  }

  const { prev, next } = siblingNav(pair, work.id)
  const kicker = workKicker(work, pair)
  const eta = formatEta(Math.round(work.wordCount * (1 - progress)))

  const articleInner = (
    <>
      <header className="reader-header">
        {kicker && <p className="reader-kicker">{kicker}</p>}
        <h1>{work.title}</h1>
      </header>

      <div className="reader-body">
        {work.paragraphs.map((p) => (
          <ParagraphView
            key={p.id}
            paragraph={p}
            characters={annotations?.characters}
            highlights={highlightsByPara.get(p.id)}
            onCharacter={annotations ? openCharacter : undefined}
          />
        ))}
      </div>

      <footer className="reader-footer-nav">
        <button
          type="button"
          className="reader-mark-finished"
          onClick={() => setFinished(toggleFinished(work.id))}
          aria-pressed={finished.has(work.id)}
        >
          {finished.has(work.id) ? 'Marked finished' : 'Mark as read'}
        </button>
        {prev ? (
          <Link to={`/read/${prev.id}`} className="nav-prev">
            <span className="nav-label">Previous</span>
            <span className="nav-title">{prev.title}</span>
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link to={`/read/${next.id}`} className="nav-next">
            <span className="nav-label">Next</span>
            <span className="nav-title">{next.title}</span>
          </Link>
        ) : (
          <Link to="/" className="nav-next">
            <span className="nav-label">Library</span>
            <span className="nav-title">All Lives</span>
          </Link>
        )}
      </footer>
    </>
  )

  return (
    <div
      className={[
        'reader-shell',
        topOpen ? 'top-open' : '',
        bottomOpen ? 'bottom-open' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="reader-progress" aria-hidden="true">
        <div style={{ width: `${progress * 100}%` }} />
      </div>

      <div className="reader-top-spacer" aria-hidden="true" />

      <div
        className="reader-top-zone"
        data-testid="reader-show-menu"
        role="button"
        tabIndex={0}
        aria-label="Show menu"
        onMouseEnter={revealTop}
        onClick={revealTop}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            revealTop()
          }
        }}
      />

      <header
        className="reader-chrome"
        onMouseEnter={revealTop}
        onMouseLeave={scheduleHideTop}
      >
        <div className="reader-chrome-row">
          <Link to="/">Library</Link>
          <div className="reader-chrome-actions">
            <button
              type="button"
              className="reader-gear"
              data-testid="reader-settings"
              aria-label="Settings"
              aria-expanded={settingsOpen}
              onClick={() => setSettingsOpen(true)}
            >
              <GearIcon />
            </button>
          </div>
        </div>
      </header>

      <SettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        theme={theme}
        onTheme={setTheme}
      />

      <CharacterSheet
        open={activeChar != null}
        character={activeChar}
        subject={annotations?.subject ?? work.title}
        characters={annotations?.characters ?? []}
        onClose={() => setActiveChar(null)}
      />

      <SelectionToolbar
        open={selection != null}
        anchor={selection?.anchor ?? null}
        canRemove={selectionCanRemove}
        onAction={onSelectionAction}
        onDismiss={dismissSelection}
      />

      <PaginatedReader
        contentKey={work.id}
        initialProgress={resumeAt}
        measureProgress={measurePageProgress}
        resolvePageIndex={resolvePageIndex}
        onStatus={onPageStatus}
        onToggleChrome={() => {
          if (hasTextSelection() || selection) return
          toggleChrome()
        }}
        onExhausted={() => {
          if (next) navigate(`/read/${next.id}`)
          else navigate('/')
        }}
      >
        <article className="reader reader-paged">{articleInner}</article>
      </PaginatedReader>

      <div className="reader-bottom-spacer" aria-hidden="true" />
      <div
        className="reader-bottom-zone"
        data-testid="reader-show-position"
        role="button"
        tabIndex={0}
        aria-label="Show reading position"
        onMouseEnter={revealBottom}
        onClick={revealBottom}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            revealBottom()
          }
        }}
      />
      <footer
        className="reader-bottom"
        onMouseEnter={revealBottom}
        onMouseLeave={scheduleHideBottom}
      >
        <div className="reader-bottom-row">
          <span className="reader-bottom-pos">
            {pageStatus.page} / {pageStatus.pageCount}
          </span>
          <span className="reader-bottom-eta">{eta}</span>
        </div>
      </footer>
    </div>
  )
}
