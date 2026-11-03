'use client'

import { type FC, useState } from 'react'
import { GoogleOutlined } from '@ant-design/icons'
import { Alert, App, Button, Form, Input, Popconfirm, Skeleton, Tag } from 'antd'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { deleteMeAPI, sendPasswordLinkAPI, updateMeAPI } from '@api/auth/main'
import { useAuthStore } from '@store/auth/store'
import { ROUTES } from '@constants/routes'
import { ErrorAlert } from '@components/ui/ErrorAlert'

const Card: FC<{ title: string; children: React.ReactNode; tone?: 'danger' }> = ({ title, children, tone }) => (
  <section className={`rounded-2xl bg-surface p-5 sm:p-6 ring-1 ${tone === 'danger' ? 'ring-danger/30' : 'ring-line'}`}>
    <h2 className={`m-0 mb-5 text-lg font-bold ${tone === 'danger' ? 'text-danger' : 'text-ink'}`}>{title}</h2>
    {children}
  </section>
)

export const AccountClient: FC = () => {
  const t = useTranslations('Account')
  const tAuth = useTranslations('Auth')
  const tCommon = useTranslations('Common')
  const user = useAuthStore.use.user()
  const setUser = useAuthStore.use.setUser()
  const router = useRouter()
  const { message, modal } = App.useApp()
  const [busy, setBusy] = useState<'profile' | 'password' | 'delete' | null>(null)
  const [error, setError] = useState<{ form: string; error: unknown } | null>(null)
  const [linkSent, setLinkSent] = useState(false)

  if (!user) return <Skeleton active className='mx-auto max-w-2xl px-4 py-8 sm:py-12' />

  const run = async (form: 'profile' | 'password' | 'delete', action: () => Promise<void>) => {
    setError(null)
    setBusy(form)
    try {
      await action()
    } catch (failure) {
      setError({ form, error: failure })
    } finally {
      setBusy(null)
    }
  }

  const errorFor = (form: string) => (error?.form === form ? <ErrorAlert error={error.error} className='mb-4' /> : null)

  return (
    <div className='mx-auto flex max-w-2xl flex-col gap-5 px-4 py-8 sm:gap-6 sm:py-12'>
      <h1 className='m-0 font-display text-title font-extrabold text-ink sm:text-3xl'>{t('title')}</h1>

      <Card title={t('profile')}>
        <Form
          layout='vertical'
          requiredMark={false}
          initialValues={{ fullName: user.fullName }}
          onFinish={({ fullName }: { fullName: string }) =>
            modal.confirm({
              title: t('saveConfirm'),
              content: t('saveConfirmText', { name: fullName.trim() }),
              okText: tCommon('save'),
              cancelText: tCommon('cancel'),
              centered: true,
              onOk: () =>
                run('profile', async () => {
                  setUser(await updateMeAPI({ fullName: fullName.trim() }))
                  message.success(t('saved'))
                }),
            })
          }
        >
          <Form.Item label={tAuth('email')}>
            <Input value={user.email} disabled />
          </Form.Item>
          <Form.Item name='fullName' label={tAuth('fullName')} rules={[{ required: true, whitespace: true, message: tAuth('required') }]}>
            <Input maxLength={100} />
          </Form.Item>
          {errorFor('profile')}
          <Button type='primary' htmlType='submit' loading={busy === 'profile'}>
            {tCommon('save')}
          </Button>
        </Form>
      </Card>

      <Card title={t('passwordSection')}>
        {user.hasGoogle && (
          <Tag icon={<GoogleOutlined />} className='mb-4'>
            {t('googleLinked')}
          </Tag>
        )}
        {linkSent ? (
          <Alert type='success' showIcon title={t('passwordLinkSent', { email: user.email })} />
        ) : (
          <>
            <p className='mt-0 mb-4 text-muted'>{t('passwordLinkText', { email: user.email })}</p>
            {errorFor('password')}
            <Button
              loading={busy === 'password'}
              onClick={() =>
                modal.confirm({
                  title: t('passwordConfirm'),
                  content: (
                    <div className='flex flex-col gap-2'>
                      <p className='m-0'>{t('passwordConfirmText', { email: user.email })}</p>
                      {user.hasPassword && <p className='m-0'>{t('passwordConfirmKeep')}</p>}
                      <p className='m-0'>{t('passwordConfirmSignOut')}</p>
                      <p className='m-0 text-muted'>{t('passwordConfirmSpam')}</p>
                    </div>
                  ),
                  okText: t('passwordConfirmOk'),
                  cancelText: tCommon('cancel'),
                  centered: true,
                  onOk: () =>
                    run('password', async () => {
                      await sendPasswordLinkAPI()
                      setLinkSent(true)
                    }),
                })
              }
            >
              {user.hasPassword ? t('changePassword') : t('setPassword')}
            </Button>
          </>
        )}
      </Card>

      <Card title={t('danger')} tone='danger'>
        <p className='mt-0 mb-4 text-muted'>{t('dangerText')}</p>
        {errorFor('delete')}
        <Popconfirm
          title={t('deleteConfirm')}
          okButtonProps={{ danger: true }}
          onConfirm={() =>
            run('delete', async () => {
              await deleteMeAPI()
              setUser(null)
              router.replace(ROUTES.home)
            })
          }
        >
          <Button danger loading={busy === 'delete'}>
            {t('deleteAccount')}
          </Button>
        </Popconfirm>
      </Card>
    </div>
  )
}
