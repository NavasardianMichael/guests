import type { FC } from 'react'
import { serializeJsonLd } from '@helpers/jsonLd'

/** One `<script type="application/ld+json">`, escaped so user text can never close the tag. */
export const JsonLd: FC<{ data: object | object[] }> = ({ data }) => (
  <script type='application/ld+json' dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />
)
