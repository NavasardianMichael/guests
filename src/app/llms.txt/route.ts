import { getTranslations } from 'next-intl/server'
import { APP_DESCRIPTION, APP_NAME, APP_NAME_LATIN } from '@constants/app'
import { FONT_SLUGS, FONTS } from '@constants/fonts'
import { formatAmount, PASS_DAYS, PASS_PRICE_AMD, PHOTO_READS_PER_PASS } from '@constants/pricing'
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

/** "21 день", "22 дня", "25 дней". */
const ruDays = (count: number): string => {
  const ten = count % 10
  const hundred = count % 100
  if (ten === 1 && hundred !== 11) return `${count} день`
  if (ten >= 2 && ten <= 4 && (hundred < 12 || hundred > 14)) return `${count} дня`
  return `${count} дней`
}

export async function GET(): Promise<Response> {
  const t = await getTranslations({ locale: 'hy', namespace: 'Templates' })
  const price = formatAmount(PASS_PRICE_AMD)
  const body = buildLlmsTxt({
    title: `${APP_NAME} (${APP_NAME_LATIN})`,
    summary: `${APP_DESCRIPTION} Ցուցակը կազմելը, նախադիտելը և անվճար ձևանմուշով տպելը անվճար է. լիարժեք հասանելիությունը՝ բոլոր ձևանմուշները, առանց կայքի նշման, անսահմանափակ ներբեռնում, արժե ${price} դրամ ${PASS_DAYS} օրով (մեկ վճարում, առանց բաժանորդագրության). ավարտից հետո ցուցակները մնում են պահպանված։`,
    details: [
      `In English: ${APP_NAME} (${APP_NAME_LATIN}) is an online tool for Armenian events — weddings, christenings, birthdays — to make a guest list and print it: a seating board (guests under their tables), a plain guest list for the entrance, place cards, or the hall plan (tables with their guests, chairs, stage and dance floor). Import the list from Excel, CSV, pasted text or — with full access, ${PHOTO_READS_PER_PASS} photos per pass — a photo of a handwritten list (read by AI), arrange guests by dragging them, in columns or rows, on any paper (A5 to A2 or a custom size), in ${TEMPLATE_LIST.length} classic and creative templates with ${FONT_SLUGS.length} Armenian fonts, then download a PDF or print on the spot. The interface is in Armenian, Russian and English. Building and previewing are free and need no account; full access — every template, no “made with” line, unlimited downloads, ${PHOTO_READS_PER_PASS} lists read from photos — is ${price} AMD for ${PASS_DAYS} days, one payment, no subscription, and the lists stay saved after it ends. Also searched as: ${KEYWORDS_EN.join(', ')}.`,
      `По-русски: ${APP_NAME} (${APP_NAME_LATIN}) — онлайн-сервис для армянских торжеств (свадьба, крестины, день рождения): составить список гостей и распечатать его — план рассадки по столам, список гостей для входа, карточки рассадки или план зала (столы с гостями, стулья, сцена и танцпол). Импорт из Excel, CSV, текста или фото рукописного списка (распознаёт ИИ), расстановка гостей перетаскиванием, по столбцам или строкам, на бумаге любого формата (от A5 до A2 или свой размер), ${TEMPLATE_LIST.length} классических и креативных шаблонов, ${FONT_SLUGS.length} армянских шрифтов, PDF или печать на месте. Интерфейс на армянском, русском и английском. Составление и просмотр бесплатны и без регистрации; полный доступ — все шаблоны, без подписи сайта, неограниченное скачивание — ${price} драмов на ${ruDays(PASS_DAYS)}, один платёж, без подписки, а списки после окончания остаются сохранёнными. Также ищут как: ${KEYWORDS_RU.join(', ')}.`,
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
