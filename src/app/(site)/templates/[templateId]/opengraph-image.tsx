import { loadCardFonts, SOCIAL_CARD_SIZE, socialCard } from '@app/socialCard'
import { ImageResponse } from 'next/og'
import { getTranslations } from 'next-intl/server'
import { APP_NAME } from '@constants/app'
import { isTemplateId, TEMPLATE_IDS } from '@constants/templates'

type Props = { params: Promise<{ templateId: string }> }

export const alt = `${APP_NAME} — ձևանմուշ`
export const size = SOCIAL_CARD_SIZE
export const contentType = 'image/png'

/** Prerendered for every template, like the page itself. */
export function generateStaticParams() {
  return TEMPLATE_IDS.map((templateId) => ({ templateId }))
}

/** A template's share preview: its name, its tagline, and two boards in its own colours. */
export default async function TemplateOpengraphImage({ params }: Props) {
  const { templateId } = await params
  const id = isTemplateId(templateId) ? templateId : 'ivory'
  const t = await getTranslations({ locale: 'hy', namespace: 'Templates' })
  return new ImageResponse(
    socialCard({
      heading: `«${t(`names.${id}`)}»`,
      subheading: t(`taglines.${id}`),
      facts: [t('cardFacts.seating'), t('cardFacts.list'), t('cardFacts.cards')],
      sheets: [
        { id, left: 760, top: 150, width: 262, tilt: -6 },
        { id, left: 880, top: 96, width: 282, tilt: 4 },
      ],
    }),
    { ...size, fonts: await loadCardFonts() }
  )
}
