/**
 * Stable design contract — themes (colors) + type prefs (typography).
 *
 * This lattice is intentional and **rarely changed**. Prefer tuning an existing
 * token over adding themes, faces, size steps, or ad-hoc color-mix underlines.
 *
 * CSS values live in `src/index.css`. Id lattices live in `prefs.ts` (theme)
 * and `readingPrefs.ts` (Aa). Keep those three in lockstep; tests assert parity.
 */

import type { TypeFontId } from './readingPrefs.ts'

/** Color tokens `[data-theme]` may override — never type metrics or spacing. */
export const THEME_COLOR_TOKENS = [
  '--bg',
  '--bg-elevated',
  '--ink',
  '--ink-muted',
  '--accent',
  '--rule',
  '--progress',
  '--highlight',
  '--link-underline',
  '--char-underline',
  '--loc-underline',
] as const

/**
 * Type tokens only `data-type-*` (or catalog pin) may set.
 * Themes must never touch these — pagination stays color-invariant.
 */
export const TYPE_METRIC_TOKENS = [
  '--font-body',
  '--font-display',
  '--font-optical',
  '--font-size-body',
  '--leading',
  '--measure',
  '--pad-x',
] as const

/** Canonical face-stack custom properties (single source in index.css). */
export const FONT_STACK_VARS = [
  '--stack-book-body',
  '--stack-book-display',
  '--stack-classic-body',
  '--stack-classic-display',
  '--stack-literary-body',
  '--stack-literary-display',
  '--stack-georgia-body',
  '--stack-georgia-display',
] as const

/**
 * Day palette hex — quote cards / PWA chrome. Must match `:root` in index.css.
 * Themes retune via CSS only; do not invent parallel palettes in components.
 */
export const DAY_THEME = {
  bg: '#f3eee4',
  bgElevated: '#ebe4d6',
  ink: '#1a1814',
  inkMuted: '#5c574e',
  accent: '#2f4a3c',
} as const

/**
 * Per-face optical factors on `.paged-content`.
 * Must match `html[data-type-font]` rules in index.css.
 */
export const FONT_OPTICAL: Record<TypeFontId, number> = {
  book: 1,
  classic: 1.03,
  literary: 1.12,
  georgia: 0.94,
}

/**
 * Underline geometry — theme-invariant.
 * Colors come from `--link-underline` / `--char-underline` / `--loc-underline`.
 */
export const UNDERLINE = {
  thickness: '1px',
  offsetLink: '0.22em',
  offsetRef: '0.18em',
} as const
