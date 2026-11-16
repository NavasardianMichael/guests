import { describe, expect, it } from 'vitest'
import { inlineLinks, parseInline, plainText } from '@helpers/inlineMarkup'

describe('parseInline', () => {
  it('splits text, links and bold, in order', () => {
    expect(parseInline('Տես [ձևանմուշները](/templates) և **PDF**-ը։')).toEqual([
      { type: 'text', value: 'Տես ' },
      { type: 'link', label: 'ձևանմուշները', href: '/templates' },
      { type: 'text', value: ' և ' },
      { type: 'bold', value: 'PDF' },
      { type: 'text', value: '-ը։' },
    ])
  })

  it('leaves text without marks whole, and unclosed marks as text', () => {
    expect(parseInline('Պարզ տեքստ')).toEqual([{ type: 'text', value: 'Պարզ տեքստ' }])
    expect(parseInline('**կիսատ [հղում](')).toEqual([{ type: 'text', value: '**կիսատ [հղում](' }])
    expect(parseInline('')).toEqual([])
  })
})

describe('plainText and inlineLinks', () => {
  const text = '**Նշում**՝ կարդացեք [ուղեցույցը](/guides/anvanaqarter) և [գինը](/pricing)։'

  it('reads the text without marks', () => {
    expect(plainText(text)).toBe('Նշում՝ կարդացեք ուղեցույցը և գինը։')
  })

  it('lists the link targets', () => {
    expect(inlineLinks(text)).toEqual(['/guides/anvanaqarter', '/pricing'])
  })
})
