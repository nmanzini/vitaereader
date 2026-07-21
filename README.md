# Vitae

A calm, structured reader for Plutarch’s *Parallel Lives* (Dryden / Clough, Project Gutenberg #674).

**Agents:** read [`AGENTS.md`](./AGENTS.md) first — it is the project harness (commands, invariants, verification loop).

## Source

Primary ingest: `content/source/pg674.epub` (Gutenberg EPUB).

```bash
# If you need to re-extract:
unzip -o content/source/pg674.epub -d content/source/epub-extract
npm run content
```

## Develop

```bash
npm install
npm run verify    # tests + lint + types + data smoke
npm run dev -- --host 127.0.0.1 --port 5175
```

## Deploy

GitHub Pages builds on push to `main` (see `.github/workflows/deploy-pages.yml`).

After the first push, enable **Settings → Pages → Source: GitHub Actions**.

Site URL (project pages): `https://<user>.github.io/vitaereader/`

## Stack

Vite + React + TypeScript PWA. Content is structured JSON preserving Life → Pair → Comparison.
