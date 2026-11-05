import type { FC, ReactNode } from 'react'

/** The centred card every auth page sits in. */
export const AuthCard: FC<{ title: string; subtitle?: string; children: ReactNode }> = ({ title, subtitle, children }) => (
  <div className='mesh-bg flex min-h-[calc(100dvh-4rem)] items-center justify-center px-4 py-10 sm:py-14'>
    <div className='w-full max-w-md rounded-3xl bg-surface p-6 shadow-[0_30px_70px_-30px_rgba(20,24,45,0.35)] ring-1 ring-line sm:p-10'>
      <h1 className='m-0 font-display text-title font-extrabold tracking-tight text-ink sm:text-3xl'>{title}</h1>
      {subtitle && <p className='mt-2 mb-0 text-muted'>{subtitle}</p>}
      <div className='mt-8'>{children}</div>
    </div>
  </div>
)
