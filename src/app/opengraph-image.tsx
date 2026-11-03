import { ImageResponse } from 'next/og'
import { APP_NAME, APP_TAGLINE } from '@constants/app'
import { FONT_SLUGS } from '@constants/fonts'
import { TEMPLATE_IDS } from '@constants/templates'
import { loadCardFonts, SOCIAL_CARD_SIZE, socialCard } from './socialCard'

export const alt = `${APP_NAME} — ${APP_TAGLINE}`
export const size = SOCIAL_CARD_SIZE
export const contentType = 'image/png'

/** The site's share preview; `helpers/metadata` points every page's OpenGraph image here. */
export default async function OpengraphImage() {
  return new ImageResponse(
    socialCard({
      heading: 'Հյուրերի ցուցակը՝ տպելու պատրաստ',
      subheading: 'Ներմուծեք, դասավորեք սեղաններով և տպեք նստատեղերի ցուցանակ',
      facts: [`${TEMPLATE_IDS.length} ձևանմուշ`, `${FONT_SLUGS.length} հայերեն տառատեսակ`, 'Excel · լուսանկար'],
      sheets: [
        { id: 'botanical', left: 752, top: 150, width: 224, tilt: -8 },
        { id: 'midnight', left: 976, top: 118, width: 224, tilt: 7 },
        { id: 'ivory', left: 852, top: 214, width: 244, tilt: 0 },
      ],
    }),
    { ...size, fonts: await loadCardFonts() }
  )
}
