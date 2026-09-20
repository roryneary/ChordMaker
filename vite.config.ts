import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as {
  version: string
}

/**
 * Which build this is, decided here rather than in the app: the app is a static
 * bundle and has no way to ask.
 *
 * Netlify builds from a detached checkout, so `git rev-parse` there names a ref
 * nobody can look up — `COMMIT_REF` is the commit it actually deployed. Local
 * `git` is the fallback, and a checkout without git (a downloaded zip) still
 * builds, with the commit simply unknown. Nothing here may throw: a missing
 * stamp is a cosmetic loss, and failing the build over it would be absurd.
 */
function buildCommit(): string {
  const fromCI = process.env.COMMIT_REF ?? process.env.GITHUB_SHA
  if (fromCI) return fromCI.slice(0, 7)
  try {
    return execSync('git rev-parse --short=7 HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim()
  } catch {
    return ''
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  /* Literals, not `import.meta.env`: these are facts about the build, and
     `define` puts them in the bundle without a VITE_ var anyone could set to
     something untrue. The date is the build's, not today's — read by the app
     long after. */
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_COMMIT__: JSON.stringify(buildCommit()),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
  },
})
