import type { ReactNode } from 'react'
import { getTranslations } from 'next-intl/server'
import { SUPPORT_ADDRESS, SUPPORT_EMAIL, SUPPORT_PHONE } from '@constants/app'
import { EnvironmentOutlined, MailOutlined, PhoneOutlined } from '@components/ui/icons'

type ContactDetail = {
  key: string
  icon: ReactNode
  label: string
  value: string
}

/** The address, email and phone under the contact form, as plain text; an empty one is left out. */
export const ContactDetails = async () => {
  const t = await getTranslations('Contact')

  const details: ContactDetail[] = [
    { key: 'address', icon: <EnvironmentOutlined />, label: t('detailsAddress'), value: SUPPORT_ADDRESS },
    { key: 'email', icon: <MailOutlined />, label: t('detailsEmail'), value: SUPPORT_EMAIL },
    { key: 'phone', icon: <PhoneOutlined />, label: t('detailsPhone'), value: SUPPORT_PHONE },
  ]
  const shown = details.filter(detail => detail.value.trim() !== '')

  return (
    <ul className='m-0 flex w-full max-w-3xl list-none flex-col gap-5 p-0 sm:flex-row sm:justify-center sm:gap-8'>
      {shown.map(detail => (
        <li key={detail.key} className='flex min-w-0 flex-col items-center gap-1.5 text-center sm:flex-1'>
          <span
            className='flex size-8 items-center justify-center rounded-full bg-accent-soft text-sm text-accent-strong'
            aria-hidden='true'
          >
            {detail.icon}
          </span>
          <span className='text-xs text-muted'>{detail.label}</span>
          <span className='text-sm font-medium wrap-break-word text-ink'>{detail.value}</span>
        </li>
      ))}
    </ul>
  )
}
