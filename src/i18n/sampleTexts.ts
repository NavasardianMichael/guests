import { getTranslations } from 'next-intl/server'
import type { SampleTexts } from '@helpers/listFactory'

/** The sample wedding's words in the request's language, for previews drawn on the server. */
export const sampleTexts = async (): Promise<SampleTexts> => {
  const t = await getTranslations('Samples')
  return {
    heading: t('heading'),
    subheading: t('subheading'),
    footer: t('footer'),
    table: (number) => t('table', { number }),
  }
}
