'use client'

import { type FC, type PropsWithChildren, useEffect } from 'react'
import { App as AntApp, ConfigProvider } from 'antd'
import enUS from 'antd/locale/en_US'
import hyAM from 'antd/locale/hy_AM'
import ruRU from 'antd/locale/ru_RU'
import { useLocale } from 'next-intl'
import { useAuthStoreBase } from '@store/auth/store'
import { DEFAULT_LOCALE, isLocale, type Locale } from '@constants/app'
import { antdTheme } from '@styles/theme'
import { LeaveGuard } from './LeaveGuard'

const ANTD_LOCALES: Record<Locale, typeof hyAM> = { hy: hyAM, ru: ruRU, en: enUS }

/** Resolves the session once per page load; every island then reads it from the store. */
const AuthBootstrap: FC = () => {
  useEffect(() => {
    const { isResolved, getMe } = useAuthStoreBase.getState()
    if (!isResolved) void getMe()
  }, [])
  return null
}

export const App: FC<PropsWithChildren> = ({ children }) => {
  const locale = useLocale()
  return (
    <ConfigProvider
      theme={antdTheme}
      locale={ANTD_LOCALES[isLocale(locale) ? locale : DEFAULT_LOCALE]}
      // Every modal and confirm dialog sits in the middle of the viewport. A modal must not set
      // `style.top`, which would push it off the centre.
      modal={{ centered: true }}
    >
      {/* component={false}: context only, no wrapper element — enables App.useApp(). */}
      <AntApp component={false}>
        <AuthBootstrap />
        {children}
        <LeaveGuard />
      </AntApp>
    </ConfigProvider>
  )
}
