import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { pathsFor } from '../../../scripts/content/indexnow.mjs'

describe('IndexNow', () => {
  it('has exactly one key file, holding its own name', () => {
    const dir = path.join(process.cwd(), 'public')
    const keys = readdirSync(dir).filter((name) => /^[0-9a-f]{32}\.txt$/.test(name))
    expect(keys).toHaveLength(1)
    expect(`${readFileSync(path.join(dir, keys[0]), 'utf8')}.txt`).toBe(keys[0])
  })

  it('announces each changed page and its hub, and both hubs for registry changes', () => {
    expect(pathsFor(['src/content/guides/anvanaqarter.ts', 'src/content/examples/harsaniq.ts', 'src/app/page.tsx'])).toEqual([
      '/examples',
      '/examples/harsaniq',
      '/guides',
      '/guides/anvanaqarter',
    ])
    expect(pathsFor(['public/content/examples/knunq.webp'])).toEqual(['/examples', '/examples/knunq'])
    expect(pathsFor(['src/content/index.ts'])).toEqual(['/examples', '/guides'])
    expect(pathsFor(['public/content/video/clip.mp4'])).toEqual(['/examples', '/guides'])
    expect(pathsFor(['README.md'])).toEqual([])
  })
})
