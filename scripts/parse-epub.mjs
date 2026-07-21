/**
 * Ingest Gutenberg #674 EPUB (Dryden / Clough) into structured corpus JSON.
 * Usage: node scripts/parse-epub.mjs
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseHTML } from 'linkedom'
import { PAIR_CATALOG, UNPAIRED, buildLifeCulture } from './pair-catalog.mjs'
import {
  classifyWork,
  displayTitle,
  normalizeWhitespace,
  slugify,
  wordCount,
} from './text.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const EPUB_DIR = join(ROOT, 'content/source/epub-extract/OEBPS')
const OUT_DIR = join(ROOT, 'content/generated')
const PUBLIC_DATA = join(ROOT, 'public/data')
const LIFE_CULTURE = buildLifeCulture()

function parseNcx() {
  const ncx = readFileSync(join(EPUB_DIR, 'toc.ncx'), 'utf8')
  const { document } = parseHTML(ncx)
  return [...document.querySelectorAll('navPoint')].map((np) => {
    const title = normalizeWhitespace(
      np.querySelector('navLabel text')?.textContent ?? '',
    )
    const src = np.querySelector('content')?.getAttribute('src') ?? ''
    return { title, href: src.split('#')[0] }
  })
}

function paragraphKind(el) {
  const cls = el.getAttribute('class') ?? ''
  if (cls.includes('poem')) return 'poem'
  if (cls.includes('noindent')) return 'noindent'
  return 'prose'
}

function extractParagraphs(doc, workSlug) {
  const chapter = doc.querySelector('div.chapter') ?? doc.querySelector('body')
  if (!chapter) return []

  const paras = []
  let i = 0
  for (const p of chapter.querySelectorAll('p')) {
    const clone = p.cloneNode(true)
    for (const br of clone.querySelectorAll('br')) {
      br.replaceWith('\n')
    }
    const raw = clone.textContent ?? ''
    const kind = paragraphKind(p)
    const text =
      kind === 'poem'
        ? raw
            .split('\n')
            .map((l) => l.trim())
            .filter(Boolean)
            .join('\n')
        : normalizeWhitespace(raw)
    if (!text) continue
    i += 1
    paras.push({
      id: `${workSlug}-p${String(i).padStart(3, '0')}`,
      kind,
      text,
    })
  }
  return paras
}

function ref(worksBySlug, id) {
  const work = worksBySlug.get(id)
  return { id, title: work.title, wordCount: work.wordCount }
}

function buildIndex(works, worksBySlug) {
  const pairs = PAIR_CATALOG.map((spec) => {
    for (const id of [...spec.greek, ...spec.roman, spec.comparison].filter(
      Boolean,
    )) {
      if (!worksBySlug.has(id)) {
        throw new Error(`Missing work for pair ${spec.slug}: ${id}`)
      }
    }
    return {
      id: spec.slug,
      slug: spec.slug,
      title: spec.title,
      greek: spec.greek.map((id) => ref(worksBySlug, id)),
      roman: spec.roman.map((id) => ref(worksBySlug, id)),
      comparison: spec.comparison ? ref(worksBySlug, spec.comparison) : null,
    }
  })

  const unpaired = UNPAIRED.map(({ slug }) => {
    if (!worksBySlug.has(slug)) throw new Error(`Missing unpaired work: ${slug}`)
    const work = worksBySlug.get(slug)
    return {
      id: slug,
      title: work.title,
      wordCount: work.wordCount,
      culture: work.culture,
    }
  })

  return {
    meta: {
      gutenbergId: 674,
      title: "Plutarch's Lives",
      translator: 'John Dryden et al.',
      editor: 'A. H. Clough',
      sourceUrl: 'https://www.gutenberg.org/ebooks/674',
      sourceFormat: 'epub',
      license: 'Public domain in the USA (Project Gutenberg)',
    },
    pairs,
    unpaired,
    totals: {
      works: works.length,
      pairs: pairs.length,
      unpaired: unpaired.length,
      words: works.reduce((n, w) => n + w.wordCount, 0),
    },
  }
}

function main() {
  if (!existsSync(join(EPUB_DIR, 'toc.ncx'))) {
    throw new Error(
      `EPUB extract not found at ${EPUB_DIR}. Unpack content/source/pg674.epub first.`,
    )
  }

  const nav = parseNcx()
  const skipTitles = new Set([
    'PLUTARCH’S LIVES',
    "PLUTARCH'S LIVES",
    'CONTENTS',
  ])

  const works = []
  for (const entry of nav) {
    if (
      skipTitles.has(entry.title) ||
      entry.title.includes('GUTENBERG') ||
      !entry.href.includes('674-h-')
    ) {
      continue
    }

    const filePath = join(EPUB_DIR, entry.href)
    if (!existsSync(filePath)) {
      console.warn('Missing file', entry.href)
      continue
    }

    const { document } = parseHTML(readFileSync(filePath, 'utf8'))
    const heading = normalizeWhitespace(
      document.querySelector('h2')?.textContent ?? entry.title,
    )
    const slug = slugify(heading)
    const kind = classifyWork(heading, slug)
    const paragraphs = extractParagraphs(document, slug)

    works.push({
      id: slug,
      slug,
      title: displayTitle(heading),
      kind,
      culture: kind === 'life' ? LIFE_CULTURE[slug] : undefined,
      sourceFile: entry.href,
      paragraphs,
      wordCount: wordCount(paragraphs.map((p) => p.text).join(' ')),
    })
  }

  const worksBySlug = new Map(works.map((w) => [w.slug, w]))
  const index = buildIndex(works, worksBySlug)

  mkdirSync(OUT_DIR, { recursive: true })
  mkdirSync(PUBLIC_DATA, { recursive: true })

  // App only needs index + per-work files (not a 4.5MB corpus dump).
  writeFileSync(join(OUT_DIR, 'index.json'), JSON.stringify(index, null, 2))
  writeFileSync(join(PUBLIC_DATA, 'index.json'), JSON.stringify(index, null, 2))
  rmSync(join(PUBLIC_DATA, 'corpus.json'), { force: true })

  const worksDir = join(PUBLIC_DATA, 'works')
  mkdirSync(worksDir, { recursive: true })
  for (const work of works) {
    writeFileSync(join(worksDir, `${work.slug}.json`), JSON.stringify(work))
  }

  console.log(
    `Parsed ${works.length} works, ${index.pairs.length} pairs, ${index.unpaired.length} unpaired.`,
  )
  console.log(
    `Total words: ${index.totals.words.toLocaleString()}. Wrote public/data/.`,
  )
}

main()
