import { getTranslations } from 'next-intl/server'
import { APP_DESCRIPTION, APP_NAME, APP_NAME_LATIN } from '@constants/app'
import { FONT_SLUGS, FONTS } from '@constants/fonts'
import { formatAmount, TEMPLATE_PRICE_AMD } from '@constants/pricing'
import { ROUTES, templatePath } from '@constants/routes'
import { KEYWORDS_EN, KEYWORDS_RU } from '@constants/seo'
import { TEMPLATE_LIST } from '@constants/templates'
import { buildLlmsTxt } from '@helpers/llmsTxt'
import { absoluteUrl } from '@helpers/url'

/**
 * `/llms.txt` — the site's index for AI answer engines: what the service is, what it costs,
 * and every template with a one-line description. Static: it changes only with a deploy.
 */
export const dynamic = 'force-static'

export async function GET(): Promise<Response> {
  const t = await getTranslations({ locale: 'hy', namespace: 'Templates' })
  const price = formatAmount(TEMPLATE_PRICE_AMD)
  const body = buildLlmsTxt({
    title: `${APP_NAME} (${APP_NAME_LATIN})`,
    summary: `${APP_DESCRIPTION} Ցուցակը կազմելը և անվճար ձևանմուշով տպելը անվճար է. մնացած ձևանմուշներից յուրաքանչյուրը՝ ${price} դրամ, մեկանգամյա վճարով, գնողի բոլոր ցուցակների համար (առանց բաժանորդագրության)։`,
    details: [
      `In English: ${APP_NAME} (${APP_NAME_LATIN}) is an online tool for Armenian events — weddings, christenings, birthdays — to make a guest list and print it: a seating board (guests under their tables), a plain guest list for the entrance, or place cards. Import the list from Excel, CSV, pasted text or a photo of a handwritten list (read by AI), arrange guests by dragging them, in columns or rows, on any paper (A5 to A2 or a custom size), in ${TEMPLATE_LIST.length} classic and creative templates with ${FONT_SLUGS.length} Armenian fonts, then download a PDF or print on the spot. The interface is in Armenian, Russian and English. Building is free and needs no account; each premium template is bought once (${price} AMD) and then prints on all of the buyer's lists. Also searched as: ${KEYWORDS_EN.join(', ')}.`,
      `По-русски: ${APP_NAME} (${APP_NAME_LATIN}) — онлайн-сервис для армянских торжеств (свадьба, крестины, день рождения): составить список гостей и распечатать его — план рассадки по столам, список гостей для входа или карточки рассадки. Импорт из Excel, CSV, текста или фото рукописного списка (распознаёт ИИ), расстановка гостей перетаскиванием, по столбцам или строкам, на бумаге любого формата (от A5 до A2 или свой размер), ${TEMPLATE_LIST.length} классических и креативных шаблонов, ${FONT_SLUGS.length} армянских шрифтов, PDF или печать на месте. Интерфейс на армянском, русском и английском. Составление бесплатно и без регистрации; каждый премиум-шаблон покупается один раз (${price} драмов) и печатается на всех списках покупателя. Также ищут как: ${KEYWORDS_RU.join(', ')}.`,
    ],
    sections: [
      {
        title: 'Էջեր',
        links: [
          { name: 'Գլխավոր', url: absoluteUrl(ROUTES.home), note: 'ինչ է ծառայությունը, հաճախ տրվող հարցեր' },
          { name: 'Ձևանմուշներ', url: absoluteUrl(ROUTES.templates), note: `բոլոր ${TEMPLATE_LIST.length} ձևանմուշները` },
          { name: 'Գինը', url: absoluteUrl(ROUTES.pricing), note: `անվճար ձևանմուշ և ${price} դրամ մեկ ձևանմուշի համար` },
          { name: 'Կապ մեզ հետ', url: absoluteUrl(ROUTES.contact), note: 'հարցեր և առաջարկներ' },
        ],
      },
      {
        title: 'Ձևանմուշներ',
        links: TEMPLATE_LIST.map((template) => ({
          name: t(`names.${template.id}`),
          url: absoluteUrl(templatePath(template.id)),
          note: t(`taglines.${template.id}`),
        })),
      },
      {
        title: 'Տառատեսակներ',
        links: [
          {
            name: FONT_SLUGS.map((slug) => FONTS[slug].name).join(', '),
            url: 'https://fonter.am/en/fonts?sortby=popular',
            note: 'հայերեն տառատեսակներ fonter.am-ից, բոլորն անվճար առևտրային օգտագործման համար',
          },
        ],
      },
      {
        title: 'Իրավական',
        links: [
          { name: 'Օգտագործման պայմաններ', url: absoluteUrl(ROUTES.terms) },
          { name: 'Գաղտնիություն', url: absoluteUrl(ROUTES.privacy) },
          { name: 'Վերադարձի քաղաքականություն', url: absoluteUrl(ROUTES.refundPolicy) },
        ],
      },
    ],
  })

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
  })
}
