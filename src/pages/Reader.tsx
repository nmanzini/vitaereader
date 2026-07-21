import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
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
  ensureHighlight,
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
  readWorkSelection,
  restoreSelection,
  selectionToolbarAnchor,
  type WorkSelection,
} from '../lib/selectionOffsets'
import { decodeSelectionRanges } from '../lib/selectionLink'
import {
  findContainingHighlight,
  normalizeRange,
  type HighlightSpan,
} from '../lib/textRanges'
import { formatEta } from '../lib/reading'
import { siblingNav, workKicker } from '../lib/workMeta'
import { useTheme } from '../lib/useTheme'
import { useReadingPrefs } from '../lib/useReadingPrefs'
import { readingPrefsLayoutKey } from '../lib/readingPrefs'
import { useReaderChrome } from '../lib/useReaderChrome'
import { SettingsSheet } from '../components/SettingsSheet'
import { CharacterSheet } from '../components/CharacterSheet'
import {
  ShareSheet,
  type ShareSheetPayload,
} from '../components/ShareSheet'
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

/** Apply `?r=` selection token: ensure highlights for each range (no dupes). */
function applySelectionToken(
  workId: string,
  work: Work,
  token: string | null,
): TextHighlight[] | null {
  if (!token?.trim()) return null
  const ranges = decodeSelectionRanges(token)
  if (!ranges?.length) return null
  const created: TextHighlight[] = []
  for (const range of ranges) {
    const para = work.paragraphs.find((p) => p.id === range.paraId)
    if (!para) continue
    const norm = normalizeRange(range.start, range.end, para.text.length)
    if (!norm) continue
    created.push(
      ensureHighlight(workId, {
        paraId: range.paraId,
        start: norm.start,
        end: norm.end,
        text: para.text.slice(norm.start, norm.end),
      }),
    )
  }
  return created.length ? created : null
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
  const {
    prefs: readingPrefs,
    setFont,
    setLeading,
    setMargin,
    nudgeSize,
  } = useReadingPrefs()
  const layoutKey = readingPrefsLayoutKey(readingPrefs)
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
    sel: WorkSelection
    anchor: DOMRect
  } | null>(null)
  const [sharePayload, setSharePayload] = useState<ShareSheetPayload | null>(
    null,
  )
  /** Keep toolbar open after highlight tap when DOM selection can't be restored. */
  const highlightFocusRef = useRef(false)

  const {
    topOpen,
    bottomOpen,
    revealChrome,
    hideChrome,
    scheduleHideChrome,
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
    const rangeToken = searchParams.get('r')
    Promise.all([loadWork(slug), loadIndex(), loadAnnotations(slug)])
      .then(([w, index, ann]) => {
        setWork(w)
        setPair(findPairForWork(index, slug))
        setAnnotations(ann)
        // Share deep-link: persist exact ranges as highlights (deduped).
        const fromLink = applySelectionToken(slug, w, rangeToken)
        if (fromLink) setHighlights(loadHighlightsFor(slug))
        const saved = clampRatio(loadProgress()[slug] ?? 0)
        const wi = buildWordIndex(w.paragraphs)
        let start = saved
        const resumePara =
          deepPara ?? fromLink?.[0]?.paraId ?? null
        if (resumePara) {
          const paraIndex = wi.ids.indexOf(resumePara)
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
    const sel = readWorkSelection(shell)
    const anchor = selectionToolbarAnchor()
    if (sel && anchor) setSelection({ sel, anchor })
    else setSelection(null)
  }, [])

  useEffect(() => {
    let showTimer = 0
    let clearTimer = 0
    function scheduleRefresh() {
      window.clearTimeout(showTimer)
      window.clearTimeout(clearTimer)
      if (hasTextSelection()) {
        highlightFocusRef.current = false
        // Settle briefly so touch handles stop thrashing the toolbar.
        showTimer = window.setTimeout(() => {
          refreshSelectionUi()
        }, 140)
      } else {
        // Sticky clear — avoid flash when range briefly collapses mid-gesture.
        // Highlight-tap fallback may pin the toolbar without a live DOM range.
        clearTimer = window.setTimeout(() => {
          if (highlightFocusRef.current) return
          if (!hasTextSelection()) setSelection(null)
          else refreshSelectionUi()
        }, 300)
      }
    }
    document.addEventListener('selectionchange', scheduleRefresh)
    document.addEventListener('mouseup', scheduleRefresh)
    document.addEventListener('touchend', scheduleRefresh)
    return () => {
      window.clearTimeout(showTimer)
      window.clearTimeout(clearTimer)
      document.removeEventListener('selectionchange', scheduleRefresh)
      document.removeEventListener('mouseup', scheduleRefresh)
      document.removeEventListener('touchend', scheduleRefresh)
    }
  }, [refreshSelectionUi])

  const dismissSelection = useCallback(() => {
    highlightFocusRef.current = false
    clearWindowSelection()
    setSelection(null)
  }, [])

  /** Tap an existing highlight → select it and open toolbar (Remove / Share). */
  const onHighlightTap = useCallback(
    (highlightId: string, markEl: HTMLElement) => {
      const h = highlights.find((x) => x.id === highlightId)
      if (!h) return
      const shell = document.querySelector('.reader-shell')
      if (!shell) return

      const restored = restoreSelection(shell, {
        start: { paraId: h.paraId, offset: h.start },
        end: { paraId: h.paraId, offset: h.end },
      })

      const anchorFromMark = () => {
        const rects = markEl.getClientRects()
        for (let i = rects.length - 1; i >= 0; i--) {
          const r = rects[i]!
          if (r.width <= 0 && r.height <= 0) continue
          if (r.bottom < 0 || r.top > window.innerHeight) continue
          if (r.right < 0 || r.left > window.innerWidth) continue
          return r
        }
        return markEl.getBoundingClientRect()
      }

      if (restored) {
        highlightFocusRef.current = false
        const sel = readWorkSelection(shell)
        const anchor = selectionToolbarAnchor() ?? anchorFromMark()
        if (sel && anchor) {
          setSelection({ sel, anchor })
          return
        }
      }

      // Fallback when programmatic selection fails (some WebViews).
      highlightFocusRef.current = true
      const paraEl =
        (markEl.closest('[data-para-id]') as HTMLElement | null) ?? markEl
      const segment = {
        paraId: h.paraId,
        paraEl,
        start: h.start,
        end: h.end,
        text: h.text,
      }
      setSelection({
        sel: { segments: [segment], text: h.text, primary: segment },
        anchor: anchorFromMark(),
      })
    },
    [highlights],
  )

  const onSelectionAction = useCallback(
    (action: SelectionToolbarAction) => {
      if (!selection || !work || !slug) return
      const { sel } = selection
      const quote = sel.text

      if (action === 'highlight') {
        const created: TextHighlight[] = []
        for (const segment of sel.segments) {
          const para = work.paragraphs.find((p) => p.id === segment.paraId)
          if (!para) continue
          const norm = normalizeRange(segment.start, segment.end, para.text.length)
          if (!norm) continue
          created.push(
            addHighlight(slug, {
              paraId: segment.paraId,
              start: norm.start,
              end: norm.end,
              text: para.text.slice(norm.start, norm.end),
            }),
          )
        }
        if (created.length) setHighlights((prev) => [...prev, ...created])
        dismissSelection()
        return
      }
      if (action === 'remove') {
        for (const segment of sel.segments) {
          const hit = findContainingHighlight(
            highlights
              .filter((h) => h.paraId === segment.paraId)
              .map((h) => ({ id: h.id, start: h.start, end: h.end })),
            segment.start,
            segment.end,
          )
          if (hit && removeHighlight(slug, hit.id)) {
            setHighlights((prev) => prev.filter((h) => h.id !== hit.id))
          }
        }
        dismissSelection()
        return
      }
      if (action === 'share') {
        setSharePayload({
          quote,
          workTitle: work.title,
          workId: work.id,
          paraId: sel.primary.paraId,
          ranges: sel.segments.map((segment) => ({
            paraId: segment.paraId,
            start: segment.start,
            end: segment.end,
          })),
        })
        dismissSelection()
        return
      }
    },
    [selection, work, slug, highlights, dismissSelection],
  )

  const selectionCanRemove = useMemo(() => {
    if (!selection) return false
    return selection.sel.segments.some((segment) =>
      findContainingHighlight(
        highlights
          .filter((h) => h.paraId === segment.paraId)
          .map((h) => ({ id: h.id, start: h.start, end: h.end })),
        segment.start,
        segment.end,
      ),
    )
  }, [selection, highlights])

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  const progressRef = useRef(progress)
  progressRef.current = progress

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
        progressRef.current,
      )
    },
    [wordIndex],
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
            onHighlight={onHighlightTap}
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
        onMouseEnter={revealChrome}
        onClick={revealChrome}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            revealChrome()
          }
        }}
      />

      <header
        className="reader-chrome"
        onMouseEnter={revealChrome}
        onMouseLeave={scheduleHideChrome}
        onClick={(e) => {
          // Empty bar tap hides; Library / Settings keep their own actions.
          if ((e.target as Element | null)?.closest?.('a, button')) return
          hideChrome()
        }}
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
        reading={readingPrefs}
        onFont={setFont}
        onSizeNudge={nudgeSize}
        onLeading={setLeading}
        onMargin={setMargin}
      />

      <CharacterSheet
        open={activeChar != null}
        character={activeChar}
        subject={annotations?.subject ?? work.title}
        characters={annotations?.characters ?? []}
        onClose={() => setActiveChar(null)}
      />

      <ShareSheet
        open={sharePayload != null}
        payload={sharePayload}
        onClose={() => setSharePayload(null)}
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
        layoutKey={layoutKey}
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
        onMouseEnter={revealChrome}
        onClick={revealChrome}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            revealChrome()
          }
        }}
      />
      <footer
        className="reader-bottom"
        onMouseEnter={revealChrome}
        onMouseLeave={scheduleHideChrome}
        onClick={hideChrome}
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
