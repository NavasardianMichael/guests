import { describe, expect, it } from 'vitest'
import { buildLlmsTxt } from '@helpers/llmsTxt'

describe('buildLlmsTxt', () => {
  it('puts the details between the summary and the sections, one paragraph each', () => {
    const text = buildLlmsTxt({
      title: 'Site',
      summary: 'What it is.',
      details: ['In English:\nline one,\n\nline two.', '   ', 'По-русски: одна строка.'],
      sections: [{ title: 'Pages', links: [{ name: 'Home', url: 'https://example.com/', note: 'start' }] }],
    })

    const blocks = [
      '# Site',
      '> What it is.',
      'In English: line one, line two.',
      'По-русски: одна строка.',
      '## Pages\n- [Home](https://example.com/): start',
    ]
    expect(text).toBe(`${blocks.join('\n\n')}\n`)
  })

  it('leaves out empty sections and works without details', () => {
    const text = buildLlmsTxt({ title: 'Site', summary: 'S', sections: [{ title: 'Empty', links: [] }] })
    expect(text).toBe('# Site\n\n> S\n')
  })
})
