import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  PAIR_CATALOG,
  UNPAIRED,
  buildLifeCulture,
} from '../scripts/pair-catalog.mjs'
import {
  classifyWork,
  displayTitle,
  slugify,
  wordCount,
} from '../scripts/text.mjs'
import {
  formatEta,
  libraryLinkState,
  locationCountFor,
  locationFromProgress,
  pageCountFor,
  pageIndexFromProgress,
  progressFromPage,
  struckCharCount,
  WORDS_PER_LIBRARY_PAGE,
} from '../src/lib/reading.ts'
import { isLegacyKindleBrowser } from '../src/lib/kindleCompat.ts'
import { libraryEntries } from '../src/lib/libraryOrder.ts'
import {
  anchorFromRatio,
  buildWordIndex,
  contentSamplePoints,
  pageIndexFromFlowX,
  ratioFromAnchor,
} from '../src/lib/contentProgress.ts'
import {
  findAnnotationMatches,
  findCharacterMatches,
  findLocationMatches,
  segmentAnnotationText,
  segmentText,
} from '../src/lib/charMatch.ts'
import {
  CAMPAIGN_BOUNDS,
  isValidGeoPoint,
  mapViewSize,
  projectEquirectangular,
  ringToSvgPath,
} from '../src/lib/geoMap.ts'
import { CAMPAIGN_LAND_RINGS } from '../src/lib/campaignLand.ts'
import {
  boundsForPoints,
  isVisitKind,
  journeyPathD,
  journeyStops,
  locationPresence,
  visitKindOf,
} from '../src/lib/journeyMap.ts'
import {
  findContainingHighlight,
  mergeHighlightSpans,
  normalizeRange,
  rangesOverlap,
  segmentWithHighlights,
} from '../src/lib/textRanges.ts'
import {
  buildCitationText,
  buildShareText,
  cardSiteHome,
  readerBaseUrl,
  threadsIntentUrl,
  truncateQuote,
  twitterIntentUrl,
  workShareUrl,
} from '../src/lib/shareQuote.ts'
import {
  decodeSelectionRanges,
  encodeSelectionRanges,
} from '../src/lib/selectionLink.ts'
import {
  cardAttribution,
  displayCardUrl,
  displaySiteHost,
  fitLines,
  measureQuoteCard,
  QUOTE_CARD_MAX_H,
  QUOTE_CARD_MIN_H,
  QUOTE_CARD_W,
  quoteCardContentHeight,
  truncateForCard,
  wrapText,
} from '../src/lib/quoteCard.ts'
import { tapZoneAt } from '../src/lib/tapZones.ts'
import {
  dragSlopPx,
  PAGE_DRAG_SLOP,
  pendingMoveDecision,
  TEXT_PAGE_DRAG_SLOP,
} from '../src/lib/pageGestureIntent.ts'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

describe('slugify', () => {
  it('normalizes titles and the COMPARISION typo', () => {
    assert.equal(slugify('THESEUS'), 'theseus')
    assert.equal(
      slugify('COMPARISION OF PELOPIDAS WITH MARCELLUS'),
      'comparison-of-pelopidas-with-marcellus',
    )
    assert.equal(
      slugify('COMPARISON OF ARISTIDES WITH MARCUS CATO.'),
      'comparison-of-aristides-with-marcus-cato',
    )
  })
})

describe('displayTitle', () => {
  it('title-cases ALL CAPS headings and keeps small words lower', () => {
    assert.equal(
      displayTitle('COMPARISON OF ROMULUS WITH THESEUS'),
      'Comparison of Romulus with Theseus',
    )
    assert.equal(displayTitle('CATO THE YOUNGER'), 'Cato the Younger')
  })

  it('leaves mixed-case titles alone', () => {
    assert.equal(displayTitle('Theseus'), 'Theseus')
  })
})

describe('classifyWork', () => {
  it('detects comparisons', () => {
    assert.equal(
      classifyWork('COMPARISON OF X WITH Y', 'comparison-of-x-with-y'),
      'comparison',
    )
    assert.equal(classifyWork('THESEUS', 'theseus'), 'life')
  })
})

describe('wordCount', () => {
  it('counts words', () => {
    assert.equal(wordCount('one two three'), 3)
    assert.equal(wordCount(''), 0)
  })
})

describe('pair catalog', () => {
  it('has unique pair slugs and life ids', () => {
    const pairSlugs = PAIR_CATALOG.map((p) => p.slug)
    assert.equal(new Set(pairSlugs).size, pairSlugs.length)

    const lifeIds = PAIR_CATALOG.flatMap((p) => [...p.greek, ...p.roman])
    assert.equal(new Set(lifeIds).size, lifeIds.length)
  })

  it('derives culture for every catalogued life', () => {
    const culture = buildLifeCulture()
    for (const pair of PAIR_CATALOG) {
      for (const id of pair.greek) assert.equal(culture[id], 'greek')
      for (const id of pair.roman) assert.equal(culture[id], 'roman')
    }
    for (const work of UNPAIRED) {
      assert.equal(culture[work.slug], work.culture)
    }
  })

  it('matches expected corpus shape', () => {
    assert.equal(PAIR_CATALOG.length, 22)
    assert.equal(UNPAIRED.length, 4)
    const withComparison = PAIR_CATALOG.filter((p) => p.comparison).length
    assert.equal(withComparison, 18)
  })
})

describe('formatEta', () => {
  it('formats remaining reading time', () => {
    assert.equal(formatEta(0), 'Done')
    assert.equal(formatEta(100, 220), '~1 min left')
    assert.equal(formatEta(2200, 220), '~10 min left')
    assert.equal(formatEta(13200, 220), '~1 hr left')
    assert.equal(formatEta(15400, 220), '~1 hr 10 min left')
  })
})

describe('pagination math', () => {
  it('computes page counts and progress mapping', () => {
    assert.equal(pageCountFor(1000, 400), 3)
    assert.equal(pageCountFor(100, 400), 1)
    assert.equal(pageCountFor(800, 0), 1)
    // Absorb subpixel scrollWidth noise (exact N pages + 0.5px → still N).
    assert.equal(pageCountFor(800.5, 400), 2)

    assert.equal(pageIndexFromProgress(0, 5), 0)
    assert.equal(pageIndexFromProgress(1, 5), 4)
    assert.equal(pageIndexFromProgress(0.5, 5), 2)

    assert.equal(progressFromPage(0, 5), 0)
    assert.equal(progressFromPage(4, 5), 1)
    assert.equal(progressFromPage(0, 1), 1)
  })

  it('maps progress to Kindle-style locations', () => {
    assert.equal(locationCountFor(0), 1)
    assert.equal(locationCountFor(16), 1)
    assert.equal(locationCountFor(17), 2)
    assert.equal(locationCountFor(1600), 100)

    assert.equal(locationFromProgress(0, 100), 1)
    assert.equal(locationFromProgress(1, 100), 100)
    assert.equal(locationFromProgress(0.5, 5), 3)
    assert.equal(locationFromProgress(0, 1), 1)
  })

  it('tap zones use page-box thirds; outer gutters inherit L/R', () => {
    // Centered measure on a wide viewport: page at [400, 900).
    assert.equal(tapZoneAt(50, 400, 500), 'prev') // left gutter
    assert.equal(tapZoneAt(420, 400, 500), 'prev') // left of text column
    assert.equal(tapZoneAt(650, 400, 500), 'center')
    assert.equal(tapZoneAt(880, 400, 500), 'next') // right of text column
    assert.equal(tapZoneAt(1200, 400, 500), 'next') // right gutter
    assert.equal(tapZoneAt(0, 0, 0), 'center')
  })

  it('page-swipe intent locks paging on clear horizontal text drags', () => {
    // Empty gutter / non-text: tight slop.
    assert.equal(dragSlopPx(false, 20, 2), PAGE_DRAG_SLOP)
    // Ambiguous text drag: extra slack to protect selection.
    assert.equal(dragSlopPx(true, 20, 18), TEXT_PAGE_DRAG_SLOP)
    // Clear sideways on text: same tight slop as gutters (whole-page feel).
    assert.equal(dragSlopPx(true, 30, 4), PAGE_DRAG_SLOP)

    assert.equal(pendingMoveDecision(true, 8, 2), 'wait')
    assert.equal(pendingMoveDecision(true, 30, 4), 'paging')
    assert.equal(pendingMoveDecision(true, 10, 40), 'selecting')
    assert.equal(pendingMoveDecision(false, 20, 40), 'cancel')
  })
})

describe('kindleCompat', () => {
  it('detects legacy e-ink Experimental Browser, not modern Silk', () => {
    assert.equal(
      isLegacyKindleBrowser(
        'Mozilla/5.0 (X11; U; Linux armv7l like Android; en-us) AppleWebKit/531.2+ (KHTML, like Gecko) Version/5.0 Safari/533.2+ Kindle/3.0+',
      ),
      true,
    )
    assert.equal(
      isLegacyKindleBrowser(
        'Mozilla/5.0 (Linux; Android 9; KFMAWI) AppleWebKit/537.36 (KHTML, like Gecko) Silk/119.0 versionCode 1190025647 Safari/537.36',
      ),
      false,
    )
  })
})

describe('library link progress', () => {
  it('stays unread until past one page of words', () => {
    const words = 10_000
    assert.equal(libraryLinkState(0, words, false), 'unread')
    assert.equal(
      libraryLinkState(WORDS_PER_LIBRARY_PAGE / words, words, false),
      'unread',
    )
    assert.equal(
      libraryLinkState((WORDS_PER_LIBRARY_PAGE + 1) / words, words, false),
      'reading',
    )
    assert.equal(libraryLinkState(0.1, words, true), 'finished')
  })

  it('strikes at least the first letter, then grows with progress', () => {
    assert.equal(struckCharCount('Theseus', 0.01), 1)
    assert.equal(struckCharCount('Theseus', 0.5), 4)
    assert.equal(struckCharCount('Theseus', 1), 7)
    assert.equal(struckCharCount('', 0.5), 0)
  })
})

describe('library order', () => {
  it('weaves unpaired lives into the pair sequence', () => {
    const root = join(dirname(fileURLToPath(import.meta.url)), '..')
    const index = JSON.parse(
      readFileSync(join(root, 'public/data/index.json'), 'utf8'),
    )
    const entries = libraryEntries(index)
    const ids = entries.map((e) =>
      e.kind === 'pair' ? e.pair.slug : e.work.id,
    )

    assert.equal(entries.length, index.pairs.length + index.unpaired.length)
    assert.ok(ids.indexOf('artaxerxes') > ids.indexOf('agesilaus-pompey'))
    assert.ok(ids.indexOf('artaxerxes') < ids.indexOf('alexander-caesar'))
    assert.ok(ids.indexOf('aratus') > ids.indexOf('agis-gracchi'))
    assert.ok(ids.indexOf('aratus') < ids.indexOf('demosthenes-cicero'))
    assert.deepEqual(ids.slice(-2), ['galba', 'otho'])
  })
})

describe('content progress', () => {
  it('round-trips anchors through word ratios', () => {
    const index = buildWordIndex([
      { id: 'a', text: 'one two three four' },
      { id: 'b', text: 'five six' },
      { id: 'c', text: 'seven eight nine ten' },
    ])
    assert.equal(index.total, 10)
    assert.deepEqual(index.prefix, [0, 4, 6])

    const mid = ratioFromAnchor(1, 0.5, index)
    assert.ok(mid > 0.4 && mid < 0.6)

    const back = anchorFromRatio(mid, index)
    assert.equal(back.paraIndex, 1)
    assert.ok(Math.abs(back.frac - 0.5) < 0.05)

    assert.equal(anchorFromRatio(0, index).paraIndex, 0)
    assert.equal(anchorFromRatio(1, index).paraIndex, 2)
  })

  it('maps multicol flow X to page indices', () => {
    assert.equal(pageIndexFromFlowX(0, 400, 10), 0)
    assert.equal(pageIndexFromFlowX(399, 400, 10), 0)
    assert.equal(pageIndexFromFlowX(400, 400, 10), 1)
    assert.equal(pageIndexFromFlowX(801, 400, 10), 2)
    assert.equal(pageIndexFromFlowX(9999, 400, 10), 9)
  })

  it('samples progress at viewport center with a small Y cluster', () => {
    const { x, ys } = contentSamplePoints(400, 800)
    assert.equal(x, 200)
    assert.equal(ys.length, 3)
    assert.equal(ys[0], 400)
    assert.ok(ys[1] < 400 && ys[2] > 400)
    assert.deepEqual(contentSamplePoints(1, 1), { x: 0, ys: [] })
  })
})

describe('charMatch', () => {
  const chars = [
    {
      id: 'dioscuri',
      names: ['Castor and Pollux', 'Dioscuri', 'Castor', 'Pollux'],
      blurb: 'Helen’s brothers',
      relation: 'Brothers of Helen',
    },
    {
      id: 'pallantidae',
      names: ['Pallantidae', 'Pallas'],
      blurb: 'Rivals',
      relation: 'Uncle’s line',
    },
    {
      id: 'aegeus',
      names: ['Aegeus'],
      blurb: 'Father',
      relation: 'Father',
    },
  ]

  it('prefers longer surface forms at the same index', () => {
    const hits = findCharacterMatches(
      'Castor and Pollux recovered Helen.',
      chars,
    )
    assert.equal(hits.length, 1)
    assert.equal(hits[0].characterId, 'dioscuri')
    assert.equal(hits[0].text, 'Castor and Pollux')
  })

  it('does not match inside a longer word', () => {
    const hits = findCharacterMatches('The Pallantidae fled from Pallas.', chars)
    assert.equal(hits.length, 2)
    assert.equal(hits[0].text, 'Pallantidae')
    assert.equal(hits[1].text, 'Pallas')
    assert.equal(findCharacterMatches('Aegeusan', chars).length, 0)
  })

  it('segments text with non-overlapping char refs', () => {
    const segs = segmentText('Aegeus met Castor and Pollux.', chars)
    assert.deepEqual(
      segs.map((s) => (s.type === 'char' ? s.characterId : s.text)),
      ['aegeus', ' met ', 'dioscuri', '.'],
    )
  })

  it('returns plain text when there are no characters', () => {
    assert.deepEqual(segmentText('Hello', []), [{ type: 'text', text: 'Hello' }])
  })

  it('requires resolutions for shared names in body text', () => {
    const philips = [
      {
        id: 'philip',
        names: ['Philip'],
        blurb: 'King of Macedon and Alexander’s father.',
        relation: 'Father',
      },
      {
        id: 'philip-acarnanian',
        names: ['Philip', 'Philip, the Acarnanian'],
        blurb: 'Physician who cured Alexander in Cilicia.',
        relation: 'Physician',
      },
      {
        id: 'philip-india',
        names: ['Philip'],
        blurb: 'Friend appointed to a large Indian satrapy.',
        relation: 'Friend; satrap',
      },
    ]
    const text =
      'His father Philip ruled Macedon. Till Philip, the Acarnanian, cured him. He appointed Philip, one of his friends.'
    // Without resolutions, only the unique longer form links.
    const bare = findCharacterMatches(text, philips)
    assert.equal(bare.length, 1)
    assert.equal(bare[0].characterId, 'philip-acarnanian')
    assert.equal(bare[0].text, 'Philip, the Acarnanian')

    const resolutions = [
      {
        paraId: 'p1',
        start: 11,
        end: 17,
        characterId: 'philip',
        note: 'father',
      },
      {
        paraId: 'p1',
        start: text.indexOf('appointed Philip') + 'appointed '.length,
        end: text.indexOf('appointed Philip') + 'appointed '.length + 6,
        characterId: 'philip-india',
        note: 'friend satrap after Porus',
      },
    ]
    const resolved = findCharacterMatches(text, philips, {
      paraId: 'p1',
      resolutions,
      ambiguous: 'skip',
    })
    assert.deepEqual(
      resolved.map((h) => h.characterId),
      ['philip', 'philip-acarnanian', 'philip-india'],
    )
  })

  it('falls back to first cast member for ambiguous sheet blurbs', () => {
    const philips = [
      {
        id: 'philip',
        names: ['Philip'],
        blurb: 'Father',
        relation: 'Father',
      },
      {
        id: 'philip-india',
        names: ['Philip'],
        blurb: 'Satrap',
        relation: 'Friend',
      },
    ]
    const hits = findCharacterMatches('Feuds with Philip followed.', philips, {
      ambiguous: 'first',
    })
    assert.equal(hits.length, 1)
    assert.equal(hits[0].characterId, 'philip')
  })

  it('resolves Alexander’s shared Philip citations from committed review data', () => {
    const root = join(dirname(fileURLToPath(import.meta.url)), '..')
    const ann = JSON.parse(
      readFileSync(join(root, 'public/data/annotations/alexander.json'), 'utf8'),
    )
    const work = JSON.parse(
      readFileSync(join(root, 'public/data/works/alexander.json'), 'utf8'),
    )
    const para = work.paragraphs.find((p) => p.id === 'alexander-p088')
    assert.ok(para)
    const hits = findCharacterMatches(para.text, ann.characters, {
      paraId: para.id,
      resolutions: ann.nameResolutions,
      ambiguous: 'skip',
    })
    const philip = hits.find((h) => h.text === 'Philip')
    assert.ok(philip)
    assert.equal(philip.characterId, 'philip-india')
    assert.ok(
      para.text.slice(philip.start, philip.end + 20).includes('one of his friends'),
    )
  })

  it('matches locations and prefers characters on equal-length ties', () => {
    const locs = [
      {
        id: 'issus',
        names: ['Issus'],
        blurb: 'Battle',
        relation: 'Battle',
        lat: 36.8,
        lon: 36.2,
      },
      {
        id: 'tyre',
        names: ['Tyre'],
        blurb: 'Siege',
        relation: 'Siege',
        lat: 33.3,
        lon: 35.2,
      },
    ]
    const hits = findLocationMatches('After Issus he marched to Tyre.', locs)
    assert.equal(hits.length, 2)
    assert.equal(hits[0].locationId, 'issus')
    assert.equal(hits[1].locationId, 'tyre')

    const mixed = findAnnotationMatches(
      'Aegeus left for Tyre.',
      chars,
      locs,
    )
    assert.deepEqual(
      mixed.map((m) => `${m.kind}:${m.kind === 'char' ? m.characterId : m.locationId}`),
      ['char:aegeus', 'loc:tyre'],
    )
  })

  it('segments location blurbs with place hops', () => {
    const locs = [
      {
        id: 'issus',
        names: ['Issus'],
        blurb: 'Before Tyre.',
        relation: 'Battle',
        lat: 36.8,
        lon: 36.2,
      },
      {
        id: 'tyre',
        names: ['Tyre'],
        blurb: 'After Issus.',
        relation: 'Siege',
        lat: 33.3,
        lon: 35.2,
      },
    ]
    const segs = segmentAnnotationText(locs[0].blurb, [], locs.slice(1))
    assert.deepEqual(
      segs.map((s) => (s.type === 'loc' ? s.locationId : s.text)),
      ['Before ', 'tyre', '.'],
    )
  })
})

describe('geoMap', () => {
  it('projects equirectangular points into viewBox space', () => {
    const mid = projectEquirectangular(
      { lat: 29, lon: 36.5 },
      CAMPAIGN_BOUNDS,
      320,
      160,
    )
    assert.ok(mid.x > 140 && mid.x < 180)
    assert.ok(mid.y > 60 && mid.y < 100)
    assert.equal(isValidGeoPoint({ lat: 36.8, lon: 36.2 }), true)
    assert.equal(isValidGeoPoint({ lat: 100, lon: 0 }), false)
  })

  it('sizes the viewBox to geographic aspect', () => {
    const { w, h } = mapViewSize(CAMPAIGN_BOUNDS, 320, 200)
    assert.equal(w, 320)
    // lon/lat span ≈ 83/34 → height ≈ 131
    assert.ok(h > 120 && h < 150)
  })

  it('turns land rings into SVG paths and keeps campaign land offline', () => {
    assert.ok(CAMPAIGN_LAND_RINGS.length >= 3)
    const d = ringToSvgPath(
      CAMPAIGN_LAND_RINGS[0],
      CAMPAIGN_BOUNDS,
      320,
      131,
    )
    assert.match(d, /^M/)
    assert.match(d, /Z$/)
    assert.ok(d.includes('L'))
  })
})

describe('journeyMap', () => {
  it('defaults presence to named and sorts visited stops', () => {
    assert.equal(locationPresence({}), 'named')
    assert.equal(locationPresence({ presence: 'visited' }), 'visited')
    assert.equal(visitKindOf({}), 'city')
    assert.equal(visitKindOf({ visitKind: 'battle' }), 'battle')
    assert.equal(isVisitKind('battle'), true)
    assert.equal(isVisitKind('siege'), false)

    const stops = journeyStops([
      {
        id: 'b',
        names: ['B'],
        blurb: 'Second stop on the march eastward.',
        relation: 'later',
        lat: 1,
        lon: 2,
        presence: 'visited',
        visitKind: 'battle',
        visitOrder: 2,
      },
      {
        id: 'a',
        names: ['A'],
        blurb: 'First city of the protagonist journey.',
        relation: 'first',
        lat: 3,
        lon: 4,
        presence: 'visited',
        visitKind: 'city',
        visitOrder: 1,
      },
      {
        id: 'n',
        names: ['N'],
        blurb: 'Only named in the narrative once.',
        relation: 'mention',
        lat: 5,
        lon: 6,
        presence: 'named',
      },
    ])
    assert.deepEqual(
      stops.map((s) => s.id),
      ['a', 'b'],
    )
    assert.equal(stops[0].kind, 'city')
    assert.equal(stops[1].kind, 'battle')
  })

  it('builds journey polylines and padded bounds', () => {
    assert.equal(journeyPathD([]), '')
    assert.equal(journeyPathD([{ x: 1, y: 2 }]), '')
    assert.equal(
      journeyPathD([
        { x: 1, y: 2 },
        { x: 3.14, y: 4.2 },
      ]),
      'M1 2L3.1 4.2',
    )

    const box = boundsForPoints([
      { lat: 40, lon: 10 },
      { lat: 42, lon: 12 },
    ], 1)
    assert.ok(box.west < 10)
    assert.ok(box.east > 12)
    assert.ok(box.south < 40)
    assert.ok(box.north > 42)
  })
})

describe('textRanges', () => {
  it('normalizes and rejects empty ranges', () => {
    assert.deepEqual(normalizeRange(2, 8, 10), { start: 2, end: 8 })
    assert.equal(normalizeRange(5, 5, 10), null)
    assert.deepEqual(normalizeRange(-2, 99, 10), { start: 0, end: 10 })
  })

  it('detects overlap and merges same-id spans', () => {
    assert.equal(rangesOverlap(0, 5, 4, 8), true)
    assert.equal(rangesOverlap(0, 4, 4, 8), false)
    assert.deepEqual(
      mergeHighlightSpans([
        { id: 'a', start: 0, end: 4 },
        { id: 'a', start: 3, end: 7 },
        { id: 'b', start: 10, end: 12 },
      ]),
      [
        { id: 'a', start: 0, end: 7 },
        { id: 'b', start: 10, end: 12 },
      ],
    )
  })

  it('composes highlights with character matches', () => {
    const text = 'Aegeus met Castor.'
    const chars = findCharacterMatches(text, [
      {
        id: 'aegeus',
        names: ['Aegeus'],
        blurb: 'Father',
        relation: 'Father',
      },
    ])
    const entities = chars.map((c) => ({
      kind: 'char',
      start: c.start,
      end: c.end,
      id: c.characterId,
    }))
    const segs = segmentWithHighlights(text, entities, [
      { id: 'h1', start: 0, end: 10 },
    ])
    assert.deepEqual(
      segs.map((s) => ({
        t: s.type,
        text: s.text,
        hl: s.highlightIds,
        c: s.type === 'char' ? s.characterId : null,
      })),
      [
        { t: 'char', text: 'Aegeus', hl: ['h1'], c: 'aegeus' },
        { t: 'text', text: ' met', hl: ['h1'], c: null },
        { t: 'text', text: ' Castor.', hl: [], c: null },
      ],
    )
  })

  it('composes highlights with location matches', () => {
    const text = 'He reached Tyre.'
    const locs = findLocationMatches(text, [
      {
        id: 'tyre',
        names: ['Tyre'],
        blurb: 'Siege',
        relation: 'Siege',
        lat: 33.3,
        lon: 35.2,
      },
    ])
    const entities = locs.map((l) => ({
      kind: 'loc',
      start: l.start,
      end: l.end,
      id: l.locationId,
    }))
    const segs = segmentWithHighlights(text, entities, [
      { id: 'h1', start: 3, end: 15 },
    ])
    assert.equal(segs.some((s) => s.type === 'loc' && s.locationId === 'tyre'), true)
  })

  it('finds a containing highlight', () => {
    const hit = findContainingHighlight(
      [{ id: 'h1', start: 2, end: 10 }],
      3,
      6,
    )
    assert.equal(hit?.id, 'h1')
    assert.equal(
      findContainingHighlight([{ id: 'h1', start: 2, end: 10 }], 1, 6),
      null,
    )
  })
})

describe('highlightsList', () => {
  it('sorts recent and groups by book in library order', async () => {
    const {
      flattenHighlights,
      groupHighlightsByBook,
      paraOrderKey,
      sortHighlightsRecent,
    } = await import('../src/lib/highlightsList.ts')

    assert.equal(paraOrderKey('theseus-p012'), 12)
    assert.equal(paraOrderKey('nope'), Number.MAX_SAFE_INTEGER)

    const titles = new Map([
      ['theseus', 'Theseus'],
      ['romulus', 'Romulus'],
    ])
    const rows = flattenHighlights(
      {
        theseus: [
          {
            id: 'a',
            paraId: 'theseus-p002',
            start: 0,
            end: 4,
            text: 'early',
            createdAt: 100,
          },
          {
            id: 'b',
            paraId: 'theseus-p001',
            start: 2,
            end: 5,
            text: 'first',
            createdAt: 300,
          },
        ],
        romulus: [
          {
            id: 'c',
            paraId: 'romulus-p001',
            start: 0,
            end: 3,
            text: 'rome',
            createdAt: 200,
          },
        ],
      },
      titles,
    )
    assert.equal(rows.length, 3)

    const recent = sortHighlightsRecent(rows)
    assert.deepEqual(
      recent.map((r) => r.id),
      ['b', 'c', 'a'],
    )

    const groups = groupHighlightsByBook(rows, ['romulus', 'theseus'])
    assert.deepEqual(
      groups.map((g) => ({
        id: g.workId,
        ids: g.highlights.map((h) => h.id),
      })),
      [
        { id: 'romulus', ids: ['c'] },
        { id: 'theseus', ids: ['b', 'a'] },
      ],
    )
  })
})

describe('readingPrefs', () => {
  it('normalizes unknown payloads and steps size', async () => {
    const {
      normalizeReadingPrefs,
      readingPrefsLayoutKey,
      stepTypeSize,
      DEFAULT_READING_PREFS,
    } = await import('../src/lib/readingPrefs.ts')

    assert.deepEqual(normalizeReadingPrefs(null), DEFAULT_READING_PREFS)
    assert.deepEqual(normalizeReadingPrefs({ font: 'nope', size: 'lg' }), {
      ...DEFAULT_READING_PREFS,
      size: 'lg',
    })
    assert.equal(stepTypeSize('md', 1), 'lg')
    assert.equal(stepTypeSize('xl', 1), 'xl')
    assert.equal(stepTypeSize('xs', -1), 'xs')
    assert.equal(
      readingPrefsLayoutKey({
        font: 'book',
        size: 'md',
        leading: 'normal',
        margin: 'wide',
      }),
      'book:md:normal:wide',
    )
  })
})

describe('selectionOffsets', () => {
  it('round-trips plain offsets through a paragraph DOM', async () => {
    const { parseHTML } = await import('linkedom')
    const { document, Node } = parseHTML(
      '<!doctype html><p data-para-id="p1">Hello <em>world</em></p>',
    )
    globalThis.document = document
    globalThis.Node = Node
    const {
      plainOffsetInElement,
      domPointFromPlainOffset,
      plainTextLength,
    } = await import('../src/lib/selectionOffsets.ts')

    const para = document.querySelector('[data-para-id="p1"]')
    assert.ok(para)
    assert.equal(plainTextLength(para), 11)
    const mid = domPointFromPlainOffset(para, 6)
    assert.ok(mid)
    assert.equal(plainOffsetInElement(para, mid.node, mid.offset), 6)
    const end = domPointFromPlainOffset(para, 11)
    assert.ok(end)
    assert.equal(plainOffsetInElement(para, end.node, end.offset), 11)
  })
})

describe('shareQuote', () => {
  it('builds a deep link with para query', () => {
    assert.equal(
      workShareUrl('theseus', {
        paraId: 'p-12',
        origin: 'https://nmanzini.github.io',
        base: '/vitaereader/',
      }),
      'https://nmanzini.github.io/vitaereader/read/theseus?p=p-12',
    )
  })

  it('builds a selection deep link with r token', () => {
    const ranges = [{ paraId: 'p-12', start: 10, end: 42 }]
    const url = workShareUrl('theseus', {
      paraId: 'p-12',
      ranges,
      origin: 'https://nmanzini.github.io',
      base: '/vitaereader/',
    })
    assert.ok(url.startsWith('https://nmanzini.github.io/vitaereader/read/theseus?'))
    const qs = new URL(url).searchParams
    assert.equal(qs.get('p'), 'p-12')
    const token = qs.get('r')
    assert.ok(token)
    assert.deepEqual(decodeSelectionRanges(token), ranges)
  })

  it('uses live origin+base for card site home', () => {
    assert.equal(
      cardSiteHome('http://127.0.0.1:5175', '/'),
      'http://127.0.0.1:5175/',
    )
    assert.equal(
      cardSiteHome('https://nmanzini.github.io', '/vitaereader/'),
      'https://nmanzini.github.io/vitaereader/',
    )
    assert.equal(
      readerBaseUrl('https://nmanzini.github.io', '/vitaereader/'),
      'https://nmanzini.github.io/vitaereader/',
    )
  })

  it('keeps share text short and tasteful', () => {
    const long = 'word '.repeat(80)
    const q = truncateQuote(long, 40)
    assert.ok(q.length <= 40)
    assert.ok(q.endsWith('…'))
    const body = buildShareText(
      'Theseus',
      'He was the founder of Athens.',
      'https://example.com/read/theseus?p=1',
    )
    assert.ok(body.includes('Theseus'))
    assert.ok(body.includes('“He was the founder of Athens.”'))
    assert.ok(body.includes('https://example.com/read/theseus?p=1'))
    assert.ok(body.length < 280)
  })

  it('builds a citation with author credit', () => {
    const citation = buildCitationText('Theseus', 'He founded Athens.', {
      url: 'https://example.com/read/theseus',
    })
    assert.ok(citation.includes('“He founded Athens.”'))
    assert.ok(citation.includes('— Theseus'))
    assert.ok(citation.includes('Plutarch · Parallel Lives'))
    assert.ok(citation.includes('https://example.com/read/theseus'))
  })

  it('builds X and Threads intent URLs', () => {
    const text = 'Theseus\n“quote”\nhttps://example.com/read/theseus'
    const x = twitterIntentUrl(text)
    assert.ok(x.startsWith('https://twitter.com/intent/tweet?text='))
    assert.ok(x.includes(encodeURIComponent(text)))

    const threads = threadsIntentUrl(text, 'https://example.com/read/theseus')
    assert.ok(threads.startsWith('https://www.threads.com/intent/post?'))
    assert.ok(threads.includes('text='))
    assert.ok(threads.includes('url='))
  })
})

describe('selectionLink', () => {
  it('round-trips a single range', () => {
    const ranges = [{ paraId: 'p-12', start: 0, end: 18 }]
    const token = encodeSelectionRanges(ranges)
    assert.ok(token)
    assert.ok(!token.includes('+'))
    assert.ok(!token.includes('/'))
    assert.ok(!token.includes('='))
    assert.deepEqual(decodeSelectionRanges(token), ranges)
  })

  it('round-trips multi-para ranges', () => {
    const ranges = [
      { paraId: 'p-12', start: 10, end: 40 },
      { paraId: 'p-13', start: 0, end: 22 },
    ]
    const token = encodeSelectionRanges(ranges)
    assert.deepEqual(decodeSelectionRanges(token), ranges)
  })

  it('rejects empty and malformed tokens', () => {
    assert.equal(encodeSelectionRanges([]), null)
    assert.equal(encodeSelectionRanges([{ paraId: '', start: 0, end: 1 }]), null)
    assert.equal(decodeSelectionRanges(''), null)
    assert.equal(decodeSelectionRanges('!!!'), null)
    assert.equal(decodeSelectionRanges('AAAA'), null)
  })
})

describe('quoteCard layout helpers', () => {
  const measure = (s) => s.length

  it('wraps by measured width', () => {
    assert.deepEqual(wrapText('one two three four', 8, measure), [
      'one two',
      'three',
      'four',
    ])
    assert.deepEqual(wrapText('', 10, measure), [])
  })

  it('hard-breaks overlong tokens', () => {
    assert.deepEqual(wrapText('abcdefghij', 4, measure), ['abcd', 'efgh', 'ij'])
  })

  it('fits lines with ellipsis', () => {
    assert.deepEqual(fitLines(['a', 'b', 'c', 'd'], 2), ['a', 'b…'])
    assert.deepEqual(fitLines(['only'], 3), ['only'])
  })

  it('formats attribution and site host', () => {
    assert.deepEqual(cardAttribution('Theseus'), {
      title: 'Theseus',
      credit: 'Plutarch · Parallel Lives',
    })
    assert.equal(
      displaySiteHost('https://nmanzini.github.io/vitaereader/'),
      'nmanzini.github.io/vitaereader',
    )
    assert.equal(
      displayCardUrl(
        'https://nmanzini.github.io/vitaereader/read/theseus?p=p-12&r=abc',
      ),
      'nmanzini.github.io/vitaereader/read/theseus',
    )
  })

  it('sizes height from quote lines without empty void', () => {
    const short = quoteCardContentHeight(2, 1)
    const tall = quoteCardContentHeight(8, 1)
    assert.ok(short < QUOTE_CARD_MIN_H)
    assert.ok(tall > short)

    const shortCard = measureQuoteCard({ quoteLineCount: 2, titleLineCount: 1 })
    assert.equal(shortCard.width, QUOTE_CARD_W)
    assert.equal(shortCard.height, QUOTE_CARD_MIN_H)
    assert.ok(shortCard.blockOffsetY > 0)

    const midCard = measureQuoteCard({ quoteLineCount: 6, titleLineCount: 1 })
    assert.ok(midCard.height >= midCard.contentHeight)
    assert.ok(midCard.height <= QUOTE_CARD_MAX_H)
    // No giant spacer: content height tracks lines, not a fixed square.
    assert.ok(midCard.contentHeight < QUOTE_CARD_W)
  })

  it('truncates long card quotes on a word boundary', () => {
    const long = 'alpha '.repeat(80)
    const t = truncateForCard(long, 40)
    assert.ok(t.length <= 40)
    assert.ok(t.endsWith('…'))
  })
})
