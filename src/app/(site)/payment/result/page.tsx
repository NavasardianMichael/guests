import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { privateMetadata } from '@helpers/metadata'
import { PaymentResultClient } from '@components/payment/PaymentResultClient'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Payment')
  return privateMetadata(t('metaTitle'))
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

const STATUSES = ['succeeded', 'failed', 'pending'] as const

const single = (value: string | string[] | undefined): string | undefined => (typeof value === 'string' ? value : undefined)

/** Where the API sends the buyer back from the bank: `?status=&list=&payment=` (routes/payments.ts). */
export default async function PaymentResultPage({ searchParams }: Props) {
  const query = await searchParams
  const status = STATUSES.find((value) => value === query.status) ?? 'failed'
  return (
    // The screen below the header (h-16), so the spinner and the result sit in its middle.
    <div className='mesh-bg flex min-h-[calc(100dvh-4rem)] flex-col px-4 py-14 sm:py-20'>
      <PaymentResultClient
        status={status}
        listId={single(query.list)}
        paymentId={single(query.payment)}
      />
    </div>
  )
}
