/**
 * Deterministic corpus smoke checks for agents.
 * Validates committed public/data without needing a browser.
 *
 * Optional live check:
 *   VITAE_BASE_URL=http://127.0.0.1:5175 npm run smoke
 */
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PAIR_CATALOG, UNPAIRED } from './pair-catalog.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DATA = join(ROOT, 'public/data')
const WORKS_DIR = join(DATA, 'works')

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function main() {
  const indexPath = join(DATA, 'index.json')
  assert.ok(existsSync(indexPath), 'missing public/data/index.json — run npm run content')

  const index = readJson(indexPath)
  assert.equal(index.meta?.gutenbergId, 674)
  assert.equal(index.pairs?.length, PAIR_CATALOG.length)
  assert.equal(index.unpaired?.length, UNPAIRED.length)
  assert.equal(index.totals?.pairs, PAIR_CATALOG.length)
  assert.equal(index.totals?.unpaired, UNPAIRED.length)
  assert.ok(index.totals?.works >= 60, 'unexpectedly few works')
  assert.ok(index.totals?.words > 500_000, 'unexpectedly few words')

  const workIds = new Set()
  for (const pair of index.pairs) {
    assert.ok(pair.slug, `pair missing slug: ${pair.id}`)
    for (const side of ['greek', 'roman']) {
      assert.ok(Array.isArray(pair[side]), `${pair.slug}.${side} must be array`)
      for (const ref of pair[side]) workIds.add(ref.id)
    }
    if (pair.comparison) workIds.add(pair.comparison.id)
  }
  for (const ref of index.unpaired) workIds.add(ref.id)

  assert.equal(workIds.size, index.totals.works)

  const files = readdirSync(WORKS_DIR).filter((f) => f.endsWith('.json'))
  assert.equal(files.length, index.totals.works)

  for (const id of workIds) {
    const path = join(WORKS_DIR, `${id}.json`)
    assert.ok(existsSync(path), `missing work file: ${id}.json`)
    const work = readJson(path)
    assert.equal(work.id, id)
    assert.ok(Array.isArray(work.paragraphs) && work.paragraphs.length > 0)
    assert.ok(work.wordCount > 0)
    assert.ok(['life', 'comparison'].includes(work.kind))
  }

  // Spot-check a canonical life used in reader QA.
  const theseus = readJson(join(WORKS_DIR, 'theseus.json'))
  assert.equal(theseus.kind, 'life')
  assert.ok(theseus.paragraphs[0].text.length > 40)

  // Optional per-work character annotations.
  const annDir = join(DATA, 'annotations')
  if (existsSync(annDir)) {
    const annFiles = readdirSync(annDir).filter((f) => f.endsWith('.json'))
    assert.ok(annFiles.length > 0, 'annotations dir empty')
    for (const file of annFiles) {
      const id = file.replace(/\.json$/, '')
      const ann = readJson(join(annDir, file))
      assert.equal(ann.workId, id, `${file}: workId must match filename`)
      assert.ok(typeof ann.subject === 'string' && ann.subject.length > 0)
      assert.ok(Array.isArray(ann.characters) && ann.characters.length > 0)
      assert.ok(
        ann.characters.length <= 45,
        `${file}: too many characters (${ann.characters.length})`,
      )
      const ids = new Set(ann.characters.map((c) => c.id))
      assert.equal(ids.size, ann.characters.length, `${file}: duplicate character id`)
      for (const c of ann.characters) {
        assert.ok(c.id && Array.isArray(c.names) && c.names.length > 0)
        assert.ok(typeof c.blurb === 'string' && c.blurb.length > 10)
        assert.ok(typeof c.relation === 'string' && c.relation.length > 0)
        if (c.links) {
          assert.ok(Array.isArray(c.links), `${file}/${c.id}: links must be array`)
          for (const link of c.links) {
            assert.ok(link.characterId, `${file}/${c.id}: link missing characterId`)
            if (link.workId == null || link.workId === id) {
              assert.ok(
                ids.has(link.characterId),
                `${file}/${c.id}: same-work link to missing ${link.characterId}`,
              )
            } else {
              assert.ok(
                workIds.has(link.workId),
                `${file}/${c.id}: link workId unknown: ${link.workId}`,
              )
            }
          }
        }
      }
    }
  }

  console.log(
    `smoke ok: ${index.totals.works} works, ${index.totals.pairs} pairs, ${index.totals.words} words`,
  )
}

async function liveCheck(baseUrl) {
  const root = baseUrl.replace(/\/$/, '')
  const indexRes = await fetch(`${root}/data/index.json`)
  assert.ok(indexRes.ok, `live index failed: ${indexRes.status}`)
  const index = await indexRes.json()
  assert.equal(index.totals?.works, 68)

  const workRes = await fetch(`${root}/data/works/theseus.json`)
  assert.ok(workRes.ok, `live theseus failed: ${workRes.status}`)

  const annRes = await fetch(`${root}/data/annotations/theseus.json`)
  assert.ok(annRes.ok, `live theseus annotations failed: ${annRes.status}`)

  // GitHub Pages serves the SPA shell for unknown paths as 404.html (status 404).
  const pageRes = await fetch(`${root}/read/theseus`)
  const html = await pageRes.text()
  assert.ok(
    pageRes.ok || pageRes.status === 404,
    `live reader route failed: ${pageRes.status}`,
  )
  assert.ok(html.includes('Vitae'), 'reader HTML missing brand')

  console.log(`live smoke ok: ${root}`)
}

main()
const base = process.env.VITAE_BASE_URL
if (base) {
  await liveCheck(base)
}
