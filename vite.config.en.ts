// English build config (docs/en/ → https://maxi-max-dev.github.io/chicken-chase/en/).
//
// Ground rule: this config must not require editing a single existing source
// file. The Chinese build (vite.config.ts → docs/) stays byte-identical.
// Everything English-specific is done at build time:
//   1. src/strings.ts is swapped for src/strings.en.ts at resolve time
//   2. the three touch-button glyphs in src/ui/touch.ts are patched in-memory
//   3. index.en.html is the entry, renamed to index.html in the output
//   4. a CJK guard fails the build if any Chinese leaks into the JS chunks
//
// Run:  npx vite build --config vite.config.en.ts
// or:   bash Tools/build-en.sh

import { defineConfig, type Plugin } from 'vite'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const CN_STRINGS = resolve(root, 'src/strings.ts')
const EN_STRINGS = resolve(root, 'src/strings.en.ts')
const TOUCH = resolve(root, 'src/ui/touch.ts')

const ENTRY_HTML = 'index.en.html'

/** Touch action button labels (1–4 Latin chars — the button is a fixed 84px circle). */
const EN_GLYPHS: Array<[string, string]> = [
  ["'扑'", "'DIVE'"], // eagle: dive
  ["'翅'", "'WING'"], // hen: open/close wings
  ["'蹲'", "'DUCK'"], // chick: emergency duck
]

/** Any `import ... from '<...>/strings'` inside src/ resolves to the English file. */
function enStrings(): Plugin {
  return {
    name: 'en-strings',
    enforce: 'pre',
    resolveId(source, importer) {
      if (!importer || !source.startsWith('.')) return null
      const abs = resolve(dirname(importer), source)
      if (abs === CN_STRINGS || `${abs}.ts` === CN_STRINGS) return EN_STRINGS
      return null
    },
  }
}

/** Patch the three ACTION_GLYPH characters in touch.ts without touching the file. */
function enTouchGlyphs(): Plugin {
  return {
    name: 'en-touch-glyphs',
    enforce: 'pre',
    transform(code, id) {
      if (resolve(id.split('?')[0]) !== TOUCH) return null
      let out = code
      for (const [cn, en] of EN_GLYPHS) {
        if (!out.includes(cn)) throw new Error(`[en-touch-glyphs] ${cn} not found in touch.ts`)
        out = out.replace(cn, en)
      }
      return { code: out, map: null }
    },
  }
}

/**
 * Vite names the output HTML after its input, so we get index.en.html.
 * Rename it to index.html (same directory, base './' → asset hrefs unchanged),
 * then refuse to ship if any Chinese survived in the JS.
 */
function enOutput(): Plugin {
  const CJK = /[一-鿿]/
  return {
    name: 'en-output',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const html = bundle[ENTRY_HTML]
      if (!html) throw new Error(`[en-output] ${ENTRY_HTML} missing from bundle`)
      delete bundle[ENTRY_HTML]
      html.fileName = 'index.html'
      bundle['index.html'] = html

      for (const [name, out] of Object.entries(bundle)) {
        if (!name.endsWith('.js') || out.type !== 'chunk') continue
        const hit = out.code.match(new RegExp(`.{0,40}${CJK.source}.{0,40}`))
        if (hit) throw new Error(`[en-output] Chinese left in ${name}: …${hit[0]}…`)
      }
    },
  }
}

export default defineConfig({
  base: './',
  plugins: [enStrings(), enTouchGlyphs(), enOutput()],
  build: {
    target: 'es2022',
    outDir: 'docs/en',
    emptyOutDir: true,
    rollupOptions: { input: resolve(root, ENTRY_HTML) },
  },
  server: { port: 5181 },
})
