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
  locationCountFor,
  locationFromProgress,
  pageCountFor,
  pageIndexFromProgress,
  progressFromPage,
} from '../src/lib/reading.ts'
import { libraryEntries } from '../src/lib/libraryOrder.ts'
import {
  anchorFromRatio,
  buildWordIndex,
  pageIndexFromFlowX,
  ratioFromAnchor,
} from '../src/lib/contentProgress.ts'
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
})
