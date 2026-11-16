import type { FC } from 'react'
import Link from 'next/link'
import { parseInline } from '@helpers/inlineMarkup'

/** Text with `[label](/path)` links and `**bold**` (`helpers/inlineMarkup`). Site paths are `<Link>`s. */
export const RichText: FC<{ text: string }> = ({ text }) =>
  parseInline(text).map((token, index) => {
    if (token.type === 'bold') {
      return (
        <strong key={index} className='font-semibold text-ink'>
          {token.value}
        </strong>
      )
    }
    if (token.type === 'link') {
      return token.href.startsWith('/') ? (
        <Link key={index} href={token.href} className='font-medium text-ink underline decoration-accent/60 underline-offset-2 hover:text-accent-strong'>
          {token.label}
        </Link>
      ) : (
        <a key={index} href={token.href} target='_blank' rel='noopener noreferrer' className='font-medium text-ink underline hover:text-accent-strong'>
          {token.label}
        </a>
      )
    }
    return token.value
  })
