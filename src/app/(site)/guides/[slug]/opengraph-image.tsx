import { loadCardFonts, SOCIAL_CARD_SIZE, socialCard } from '@app/socialCard'
import { ImageResponse } from 'next/og'
import { APP_NAME } from '@constants/app'
import { findGuide, GUIDES, readingMinutes } from '@content/index'

type Props = { params: Promise<{ slug: string }> }

export const alt = `${APP_NAME} — ուղեցույց`
export const size = SOCIAL_CARD_SIZE
export const contentType = 'image/png'

/** Prerendered for every guide, like the page itself. */
export function generateStaticParams() {
  return GUIDES.map((guide) => ({ slug: guide.slug }))
}

/** A guide's share preview: its short title, its reading time, two boards in its card template. */
export default async function GuideOpengraphImage({ params }: Props) {
  const guide = findGuide((await params).slug) ?? GUIDES[0]
  const id = guide.cardTemplate
  return new ImageResponse(
    socialCard({
      heading: guide.shortTitle,
      subheading: 'Գործնական ուղեցույց՝ օրինակներով',
      facts: [`${readingMinutes(guide)} րոպե ընթերցանություն`, 'Հայերեն'],
      sheets: [
        { id, left: 760, top: 150, width: 262, tilt: -6 },
        { id, left: 880, top: 96, width: 282, tilt: 4 },
      ],
    }),
    { ...size, fonts: await loadCardFonts() }
  )
}
