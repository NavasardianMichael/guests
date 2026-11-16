import type { FC } from 'react'
import { getTranslations } from 'next-intl/server'
import type { ContentBlock, ContentSection } from '@content/types'
import { RichText } from './RichText'

type Labels = { weak: string; strong: string; tip: string }

const Block: FC<{ block: ContentBlock; labels: Labels }> = ({ block, labels }) => {
  switch (block.kind) {
    case 'p':
      return (
        <p className='mt-4 mb-0 leading-relaxed text-text'>
          <RichText text={block.text} />
        </p>
      )
    case 'list': {
      const List = block.ordered ? 'ol' : 'ul'
      return (
        <List className={`mt-4 mb-0 flex flex-col gap-2 pl-6 leading-relaxed text-text ${block.ordered ? 'list-decimal' : 'list-disc'} marker:text-accent`}>
          {block.items.map((item) => (
            <li key={item}>
              <RichText text={item} />
            </li>
          ))}
        </List>
      )
    }
    case 'tip':
      return (
        <aside className='mt-5 rounded-2xl bg-accent-soft px-5 py-4 leading-relaxed text-text'>
          <span className='mb-1 block text-xs font-semibold tracking-wider text-accent-strong uppercase'>{labels.tip}</span>
          <RichText text={block.text} />
        </aside>
      )
    case 'compare':
      return (
        <div className='mt-5 grid gap-3 sm:grid-cols-2'>
          <figure className='m-0 rounded-2xl bg-surface p-4 ring-1 ring-line'>
            <figcaption className='text-xs font-semibold tracking-wider text-danger uppercase'>✕ {labels.weak}</figcaption>
            <blockquote className='m-0 mt-2 leading-relaxed text-muted'>
              <RichText text={block.weak} />
            </blockquote>
          </figure>
          <figure className='m-0 rounded-2xl bg-surface p-4 ring-1 ring-success/40'>
            <figcaption className='text-xs font-semibold tracking-wider text-success uppercase'>✓ {labels.strong}</figcaption>
            <blockquote className='m-0 mt-2 leading-relaxed text-ink'>
              <RichText text={block.strong} />
            </blockquote>
          </figure>
        </div>
      )
    case 'sample':
      return (
        <figure className='m-0 mt-5 rounded-2xl bg-surface p-5 ring-1 ring-line'>
          <figcaption className='text-xs font-semibold tracking-wider text-muted uppercase'>{block.label}</figcaption>
          <blockquote className='m-0 mt-3 leading-relaxed whitespace-pre-line text-ink'>{block.text}</blockquote>
        </figure>
      )
  }
}

/** An article's sections: an `<h2>` each, anchored for the table of contents. */
export const ContentSections: FC<{ sections: ContentSection[] }> = async ({ sections }) => {
  const t = await getTranslations('Content')
  const labels: Labels = { weak: t('weak'), strong: t('strong'), tip: t('tip') }
  return sections.map((section) => (
    <section key={section.id} id={section.id} className='mt-12 scroll-mt-24' aria-labelledby={`${section.id}-heading`}>
      <h2 id={`${section.id}-heading`} className='m-0 font-display text-2xl font-extrabold tracking-tight text-ink sm:text-[1.75rem]'>
        {section.heading}
      </h2>
      {section.blocks.map((block, index) => (
        <Block key={index} block={block} labels={labels} />
      ))}
    </section>
  ))
}
