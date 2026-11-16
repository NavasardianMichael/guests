import { loadCardFonts, SOCIAL_CARD_SIZE, socialCard } from '@app/socialCard'
import { ImageResponse } from 'next/og'
import { getTranslations } from 'next-intl/server'
import { APP_NAME } from '@constants/app'
import { EVENT_EXAMPLES, findExample } from '@content/index'

type Props = { params: Promise<{ slug: string }> }

export const alt = `${APP_NAME} — տոնի հյուրերի ցուցակի օրինակ`
export const size = SOCIAL_CARD_SIZE
export const contentType = 'image/png'

/** Prerendered for every example, like the page itself. */
export function generateStaticParams() {
  return EVENT_EXAMPLES.map((example) => ({ slug: example.slug }))
}

/** An example's share preview: the event, what it prints, and two boards in its template. */
export default async function ExampleOpengraphImage({ params }: Props) {
  const example = findExample((await params).slug) ?? EVENT_EXAMPLES[0]
  const id = example.sheet.templateId
  const t = await getTranslations({ locale: 'hy', namespace: 'Templates' })
  const tEditor = await getTranslations({ locale: 'hy', namespace: 'Editor' })
  return new ImageResponse(
    socialCard({
      heading: example.event,
      subheading: tEditor(`layout.kinds.${example.sheet.kind}`),
      facts: [`«${t(`names.${id}`)}» ձևանմուշ`, 'Բացեք և լրացրեք', 'PDF'],
      sheets: [
        { id, left: 760, top: 150, width: 262, tilt: -6 },
        { id, left: 880, top: 96, width: 282, tilt: 4 },
      ],
    }),
    { ...size, fonts: await loadCardFonts() }
  )
}
