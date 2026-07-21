import { copyFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import legacy from '@vitejs/plugin-legacy'
import { VitePWA } from 'vite-plugin-pwa'

/** Project Pages need `/repo/`; local/dev and most hosts use `/`. */
const base = process.env.VITE_BASE || '/'

export default defineConfig({
  base,
  plugins: [
    react(),
    legacy({
      // Fire Silk / older mobile WebKit. E-ink Experimental Browser is too old
      // for React; kindleCompat shows a boot message there instead.
      targets: [
        'Safari >= 12',
        'iOS >= 12',
        'Chrome >= 70',
        'Firefox >= 68',
        'Android >= 8',
      ],
      modernPolyfills: true,
      additionalLegacyPolyfills: ['regenerator-runtime/runtime'],
    }),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Vitae — Plutarch’s Lives',
        short_name: 'Vitae',
        description:
          'A calm, structured reading of Plutarch’s Parallel Lives.',
        theme_color: '#1a1814',
        background_color: '#f3eee4',
        display: 'standalone',
        start_url: base,
        scope: base,
        icons: [
          {
            src: 'favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        // Per-work JSON is cached at runtime; skip the monolithic corpus.
        globPatterns: ['**/*.{js,css,html,svg,woff2}', 'data/index.json'],
        navigateFallback: 'index.html',
        runtimeCaching: [
          {
            urlPattern: /\/data\/works\/.*\.json$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'vitae-works',
              expiration: {
                maxEntries: 80,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
            },
          },
          {
            urlPattern: /\/data\/annotations\/.*\.json$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'vitae-annotations',
              expiration: {
                maxEntries: 80,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: {
                statuses: [200],
              },
            },
          },
        ],
      },
    }),
    {
      // GitHub Pages serves 404.html for unknown paths (SPA deep links).
      name: 'spa-fallback-404',
      closeBundle() {
        const index = join('dist', 'index.html')
        if (existsSync(index)) copyFileSync(index, join('dist', '404.html'))
      },
    },
  ],
})
