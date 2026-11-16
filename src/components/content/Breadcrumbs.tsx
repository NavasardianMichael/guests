import { type FC, Fragment } from 'react'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { breadcrumbSchema } from '@linkedDataSchema/site'
import { JsonLd } from '@components/seo/JsonLd'

export type Crumb = { name: string; path: string }

/** The trail shown above a page and its BreadcrumbList JSON-LD, from one list. The last crumb is the page. */
export const Breadcrumbs: FC<{ items: Crumb[] }> = async ({ items }) => {
  const tNav = await getTranslations('Nav')
  return (
    <>
      <JsonLd data={breadcrumbSchema(items)} />
      <nav aria-label={tNav('breadcrumb')} className='text-sm text-muted'>
        {items.map((item, index) => (
          <Fragment key={item.path}>
            {index > 0 && <span aria-hidden='true'> / </span>}
            {index === items.length - 1 ? (
              <span aria-current='page' className='text-ink'>
                {item.name}
              </span>
            ) : (
              <Link href={item.path} className='text-muted no-underline hover:text-ink'>
                {item.name}
              </Link>
            )}
          </Fragment>
        ))}
      </nav>
    </>
  )
}
