import type { FC } from 'react'
import Link from 'next/link'
import { getLocale, getTranslations } from 'next-intl/server'
import { APP_NAME } from '@constants/app'
import { examplePath, guidePath, newListPath, ROUTES } from '@constants/routes'
import { exampleImage, exampleImageAlt } from '@content/exampleImages'
import { readingMinutes, videoFiles } from '@content/index'
import type { ContentSection, ContentVideo, EventExample, Guide } from '@content/types'
import { formatDate } from '@helpers/date'
import { videoSchema } from '@linkedDataSchema/content'
import { JsonLd } from '@components/seo/JsonLd'
import { TemplateCardLink, TemplateCardPending } from '@components/templates/TemplateCardLink'
import { ArrowRightOutlined } from '@components/ui/icons'

/** The template's Armenian name, as the (Armenian) content pages name it. */
export const templateNameHy = async (example: EventExample): Promise<string> => {
  const t = await getTranslations({ locale: 'hy', namespace: 'Templates' })
  return t(`names.${example.sheet.templateId}`)
}

/** Byline, updated date and reading time, under a page's `<h1>`. `<time>` carries the machine date. */
export const ContentMeta: FC<{ page: Guide | EventExample }> = async ({ page }) => {
  const t = await getTranslations('Content')
  const locale = await getLocale()
  return (
    <p className='m-0 mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted'>
      {/* Who stands behind the text: the About page, which the Article's author also names. */}
      <span>
        {t.rich('byline', {
          name: APP_NAME,
          link: (chunks) => (
            <Link href={ROUTES.about} className='text-muted underline underline-offset-2 hover:text-ink'>
              {chunks}
            </Link>
          ),
        })}
      </span>
      <span>{t.rich('updated', { date: () => <time dateTime={page.updated}>{formatDate(page.updated, locale)}</time> })}</span>
      <span>{t('readingTime', { minutes: readingMinutes(page) })}</span>
    </p>
  )
}

/** Jump links to a page's sections, and to its questions. */
export const TableOfContents: FC<{ sections: ContentSection[]; hasFaq: boolean }> = async ({ sections, hasFaq }) => {
  const t = await getTranslations('Content')
  if (sections.length < 3) return null
  const items = [...sections.map((section) => ({ id: section.id, label: section.heading })), ...(hasFaq ? [{ id: 'hartser', label: t('faqTitle') }] : [])]
  return (
    <nav aria-labelledby='toc-heading' className='mt-8 rounded-2xl bg-surface p-5 ring-1 ring-line'>
      <h2 id='toc-heading' className='m-0 text-sm font-semibold tracking-wider text-muted uppercase'>
        {t('toc')}
      </h2>
      <ol className='m-0 mt-3 flex list-decimal flex-col gap-1.5 pl-5 text-[15px] marker:text-muted'>
        {items.map((item) => (
          <li key={item.id}>
            <a href={`#${item.id}`} className='text-ink no-underline hover:text-accent-strong hover:underline'>
              {item.label}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  )
}

/** "Make yours now": the end of every content page. */
export const ContentCta: FC = async () => {
  const t = await getTranslations('Content')
  return (
    <section className='relative mt-14 overflow-hidden rounded-3xl bg-ink px-6 py-10 text-center sm:px-10'>
      <div className='pointer-events-none absolute -top-20 -right-20 size-60 rounded-full bg-accent opacity-30 blur-3xl' aria-hidden='true' />
      <h2 className='text-balance relative m-0 font-display text-2xl font-extrabold tracking-tight text-white sm:text-3xl'>{t('ctaTitle')}</h2>
      <p className='relative mx-auto mt-3 mb-0 max-w-xl text-white/80'>{t('ctaText')}</p>
      <div className='relative mt-6 flex flex-wrap justify-center gap-3'>
        <Link
          href={newListPath()}
          // The editor: never worth a crawl, and a prefetch would start a list.
          prefetch={false}
          rel='nofollow'
          className='inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 font-semibold text-white no-underline transition hover:-translate-y-0.5 hover:bg-accent-strong'
        >
          {t('ctaButton')} <ArrowRightOutlined />
        </Link>
        <Link href={ROUTES.templates} className='inline-flex items-center rounded-full px-6 py-3 font-semibold text-white no-underline ring-1 ring-white/30 transition hover:bg-white/10'>
          {t('ctaTemplates')}
        </Link>
      </div>
    </section>
  )
}

export const GuideCard: FC<{ guide: Guide; headingLevel?: 'h2' | 'h3' }> = async ({ guide, headingLevel: Heading = 'h3' }) => {
  const t = await getTranslations('Content')
  return (
    <Link
      href={guidePath(guide.slug)}
      className='group flex h-full flex-col rounded-2xl bg-surface p-5 text-inherit no-underline ring-1 ring-line transition hover:-translate-y-1 hover:shadow-[0_18px_40px_-18px_rgba(20,24,45,0.35)] sm:p-6'
    >
      <Heading className='m-0 font-display text-lg font-bold text-ink group-hover:text-accent-strong'>{guide.shortTitle}</Heading>
      <p className='m-0 mt-2 flex-1 text-sm leading-relaxed text-muted'>{guide.description}</p>
      <span className='mt-4 text-xs font-medium text-muted'>{t('readingTime', { minutes: readingMinutes(guide) })}</span>
    </Link>
  )
}

/** An example's sheet (its picture, `content/exampleImages`) at its own proportions. */
export const ExamplePicture: FC<{ example: EventExample; loading: 'lazy' | 'eager'; className?: string }> = async ({
  example,
  loading,
  className = 'block h-auto w-full',
}) => {
  const image = exampleImage(example)
  const alt = exampleImageAlt(example, await templateNameHy(example))
  return (
    // A static file drawn at 2x for its largest use: `next/image` would only re-encode it.
    <img
      src={image.src}
      width={image.width}
      height={image.height}
      alt={alt}
      loading={loading}
      // The page's main picture is its largest paint: fetched first, not after the scripts.
      fetchPriority={loading === 'eager' ? 'high' : 'auto'}
      decoding='async'
      className={className}
    />
  )
}

/**
 * An example's picture, linking to its page. Sheets are portrait or landscape (the hall plan),
 * so every card gives its picture the same box and fits it inside: the grid stays even.
 */
export const ExampleCard: FC<{ example: EventExample; headingLevel?: 'h2' | 'h3' }> = ({ example, headingLevel: Heading = 'h3' }) => (
  <TemplateCardLink href={examplePath(example.slug)} className='group block rounded-2xl text-inherit no-underline focus-visible:outline-offset-4'>
    <div className='relative grid aspect-[5/6] place-items-center overflow-hidden rounded-2xl bg-canvas p-4 ring-1 ring-line transition duration-300 group-hover:-translate-y-1.5 group-hover:shadow-[0_24px_50px_-16px_rgba(20,24,45,0.35)] sm:p-5'>
      <ExamplePicture example={example} loading='lazy' className='block h-auto max-h-full w-auto max-w-full shadow-[0_10px_30px_-12px_rgba(20,24,45,0.35)]' />
      <TemplateCardPending />
    </div>
    <div className='mt-4 px-1'>
      <Heading className='m-0 font-display text-lg font-bold text-ink'>{example.event}</Heading>
      <p className='m-0 mt-1 text-sm text-muted'>{example.shortTitle}</p>
    </div>
  </TemplateCardLink>
)

/**
 * A tutorial video under an article's intro, with its VideoObject JSON-LD. Nothing downloads
 * until play (`preload="none"`): the poster is all the page loads. No autoplay; the music is
 * quiet; the steps are in the picture and, for screen readers and muted players, in the
 * captions track the recorder writes.
 */
export const ContentVideoPlayer: FC<{ video: ContentVideo; pagePath: string }> = ({ video, pagePath }) => {
  const files = videoFiles(video)
  return (
    <figure className='m-0 mt-8'>
      <JsonLd data={videoSchema(video, pagePath)} />
      <video
        controls
        preload='none'
        playsInline
        poster={files.poster}
        width={video.width}
        height={video.height}
        className='block h-auto w-full rounded-2xl bg-ink shadow-[0_20px_50px_-25px_rgba(20,24,45,0.5)] ring-1 ring-black/5'
        aria-label={video.title}
      >
        <source src={files.src} type='video/mp4' />
        <track kind='captions' src={files.captions} srcLang='hy' label='Հայերեն' />
      </video>
      <figcaption className='mt-3 text-sm leading-relaxed text-muted'>
        <strong className='font-semibold text-ink'>{video.title}</strong> · {video.description}
      </figcaption>
    </figure>
  )
}
