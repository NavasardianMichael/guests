import type { BreadcrumbList, FAQPage, ItemList, Organization, WebApplication, WebSite, WithContext } from 'schema-dts'
import {
  APP_DESCRIPTION,
  APP_NAME,
  APP_NAME_LATIN,
  LOCALE,
  SUPPORT_EMAIL,
  SUPPORT_PHONE_TEL,
  SUPPORT_POSTAL_ADDRESS,
} from '@constants/app'
import { FONT_SLUGS } from '@constants/fonts'
import { CURRENCY, PASS_DAYS, PASS_PRICE_AMD } from '@constants/pricing'
import { ROUTES, templatePath } from '@constants/routes'
import { ALTERNATE_NAMES, SEARCH_KEYWORDS } from '@constants/seo'
import { TEMPLATE_LIST, type TemplateId } from '@constants/templates'
import { absoluteUrl } from '@helpers/url'

/**
 * JSON-LD for search and answer engines, in Armenian (the indexed language). Entity `@id`s
 * are stable URLs with a fragment, so every page that mentions the organisation or the app
 * points at the same node.
 */
export const ORGANIZATION_ID = absoluteUrl('/#organization')
export const WEBSITE_ID = absoluteUrl('/#website')
export const APP_ID = absoluteUrl('/#app')

export const organizationSchema = (): WithContext<Organization> => ({
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': ORGANIZATION_ID,
  name: APP_NAME,
  alternateName: APP_NAME_LATIN,
  url: absoluteUrl('/'),
  logo: absoluteUrl('/icon'),
  email: SUPPORT_EMAIL,
  telephone: SUPPORT_PHONE_TEL,
  address: {
    '@type': 'PostalAddress',
    streetAddress: SUPPORT_POSTAL_ADDRESS.street,
    addressLocality: SUPPORT_POSTAL_ADDRESS.locality,
    addressCountry: SUPPORT_POSTAL_ADDRESS.country,
  },
  contactPoint: {
    '@type': 'ContactPoint',
    contactType: 'customer support',
    email: SUPPORT_EMAIL,
    telephone: SUPPORT_PHONE_TEL,
    url: absoluteUrl(ROUTES.contact),
    availableLanguage: ['hy', 'ru', 'en'],
    areaServed: 'AM',
  },
  areaServed: { '@type': 'Country', name: 'Armenia' },
})

export const websiteSchema = (): WithContext<WebSite> => ({
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': WEBSITE_ID,
  name: APP_NAME,
  alternateName: ALTERNATE_NAMES,
  url: absoluteUrl('/'),
  inLanguage: LOCALE,
  publisher: { '@id': ORGANIZATION_ID },
})

/** The product itself, with its two offers, so answer engines can quote what it costs. */
export const webApplicationSchema = (): WithContext<WebApplication> => ({
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  '@id': APP_ID,
  name: APP_NAME,
  alternateName: ALTERNATE_NAMES,
  url: absoluteUrl('/'),
  description: APP_DESCRIPTION,
  keywords: SEARCH_KEYWORDS.join(', '),
  applicationCategory: 'LifestyleApplication',
  operatingSystem: 'Any (web browser)',
  inLanguage: ['hy', 'ru', 'en'],
  isAccessibleForFree: true,
  publisher: { '@id': ORGANIZATION_ID },
  featureList: [
    'Հյուրերի ներմուծում Excel-ից, CSV-ից, տեքստից և լուսանկարից (արհեստական բանականությամբ)',
    'Նստատեղերի ցուցանակ, հյուրերի ցուցակ և անվանաքարտեր',
    'Հյուրերի դասավորում քաշելով, սյունակներով և տողերով',
    `${TEMPLATE_LIST.length} դասական և ստեղծագործական ձևանմուշ`,
    `${FONT_SLUGS.length} հայերեն տառատեսակ`,
    'Ցանկացած չափի թուղթ՝ A5-ից մինչև A2 և անհատական չափ',
    'PDF ներբեռնում և տպում',
  ],
  offers: [
    {
      '@type': 'Offer',
      price: 0,
      priceCurrency: CURRENCY,
      description: 'Ցուցակի կազմում, նախադիտում և տպում անվճար ձևանմուշով',
      availability: 'https://schema.org/InStock',
    },
    {
      '@type': 'Offer',
      price: PASS_PRICE_AMD,
      priceCurrency: CURRENCY,
      description: `Լիարժեք հասանելիություն ${PASS_DAYS} օրով՝ բոլոր ձևանմուշները, առանց կայքի նշման, մեկ վճարում`,
      availability: 'https://schema.org/InStock',
    },
  ],
})

export const faqSchema = (items: { question: string; answer: string }[]): WithContext<FAQPage> => ({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  inLanguage: LOCALE,
  mainEntity: items.map((item) => ({
    '@type': 'Question',
    name: item.question,
    acceptedAnswer: { '@type': 'Answer', text: item.answer },
  })),
})

export const breadcrumbSchema = (items: { name: string; path: string }[]): WithContext<BreadcrumbList> => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: items.map((item, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: item.name,
    item: absoluteUrl(item.path),
  })),
})

export const templatesListSchema = (nameOf: (id: TemplateId) => string, listName: string): WithContext<ItemList> => ({
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  name: listName,
  numberOfItems: TEMPLATE_LIST.length,
  itemListElement: TEMPLATE_LIST.map((template, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    url: absoluteUrl(templatePath(template.id)),
    name: nameOf(template.id),
  })),
})
