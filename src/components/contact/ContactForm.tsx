'use client'

import { type FC, useEffect, useState } from 'react'
import { Alert, Button, Form, Input } from 'antd'
import { useTranslations } from 'next-intl'
import { sendContactMessageAPI } from '@api/contact/main'
import type { ContactPayload } from '@api/contact/types'
import { useAuthStore } from '@store/auth/store'
import { ErrorAlert } from '@components/ui/ErrorAlert'

/** Twin of `MAX_CONTACT_MESSAGE_LENGTH` in `server/src/routes/contact.ts`. */
export const MAX_CONTACT_MESSAGE_LENGTH = 5000

/**
 * The contact form. A signed-in visitor finds their name and email filled in. `website` is a
 * honeypot: moved off-screen and out of the tab order, so only a bot fills it, and the API
 * then drops the message while answering as if it went.
 */
export const ContactForm: FC = () => {
  const t = useTranslations('Contact')
  const user = useAuthStore.use.user()
  const [form] = Form.useForm<ContactPayload>()
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [error, setError] = useState<unknown>(null)

  // The session resolves after the first render; fill only what the visitor has not typed.
  useEffect(() => {
    if (!user) return
    if (!form.getFieldValue('fullName')) form.setFieldValue('fullName', user.fullName)
    if (!form.getFieldValue('email')) form.setFieldValue('email', user.email)
  }, [user, form])

  const onFinish = async (values: ContactPayload) => {
    setError(null)
    setState('sending')
    try {
      await sendContactMessageAPI({ ...values, website: values.website ?? '' })
      setState('sent')
      form.resetFields(['message'])
    } catch (failure) {
      setError(failure)
      setState('idle')
    }
  }

  if (state === 'sent') {
    return (
      <div className='flex flex-col items-start gap-4'>
        <Alert type='success' showIcon className='w-full' title={t('sent')} description={t('sentText')} />
        <Button onClick={() => setState('idle')}>{t('sendAnother')}</Button>
      </div>
    )
  }

  return (
    <Form<ContactPayload>
      form={form}
      layout='vertical'
      requiredMark={false}
      onFinish={onFinish}
      disabled={state === 'sending'}
    >
      <Form.Item
        name='fullName'
        label={t('fullName')}
        rules={[{ required: true, whitespace: true, message: t('required') }]}
      >
        <Input size='large' autoComplete='name' maxLength={100} />
      </Form.Item>
      <Form.Item
        name='email'
        label={t('email')}
        rules={[
          { required: true, message: t('required') },
          { type: 'email', message: t('invalidEmail') },
        ]}
      >
        <Input size='large' type='email' autoComplete='email' />
      </Form.Item>
      <Form.Item
        name='message'
        label={t('message')}
        rules={[{ required: true, whitespace: true, message: t('required') }]}
      >
        <Input.TextArea
          rows={6}
          placeholder={t('messagePlaceholder')}
          maxLength={MAX_CONTACT_MESSAGE_LENGTH}
          showCount
        />
      </Form.Item>
      <div className='absolute -left-[10000px] h-px w-px overflow-hidden' aria-hidden='true'>
        <Form.Item name='website' label='Website'>
          <Input tabIndex={-1} autoComplete='off' />
        </Form.Item>
      </div>
      {Boolean(error) && <ErrorAlert error={error} className='mb-4' />}
      <Button type='primary' htmlType='submit' size='large' block loading={state === 'sending'}>
        {t('submit')}
      </Button>
    </Form>
  )
}
