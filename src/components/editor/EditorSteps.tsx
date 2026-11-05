'use client'

import { type FC, Fragment } from 'react'
import { useTranslations } from 'next-intl'
import { useEditorUiStore } from '@store/editorUi/store'
import { cn } from '@helpers/cn'
import { EDITOR_TABS, TAB_ICONS } from './panels/EditorPanel'

/**
 * The arrow between two steps, in the current text colour: a solid shaft once the step it
 * leads to is reached, a dotted one while it is still ahead.
 */
const StepConnector: FC<{ done: boolean }> = ({ done }) => (
  <span className='flex w-full items-center'>
    <span
      className={cn(
        'h-1 flex-1',
        done
          ? 'bg-[linear-gradient(currentColor,currentColor)] bg-size-[100%_2px] bg-center bg-no-repeat'
          : 'bg-[radial-gradient(circle,currentColor_1.25px,transparent_1.75px)] bg-size-[6px_4px] bg-left bg-repeat-x'
      )}
    />
    <svg viewBox='0 0 6 10' className='-ml-1 h-2.5 w-1.5 shrink-0' fill='none' stroke='currentColor' strokeWidth={1.75} strokeLinecap='round' strokeLinejoin='round'>
      <path d='M1 1l4 4-4 4' />
    </svg>
  </span>
)

/**
 * Desktop: the editor's panels as the steps of making a list — guests, layout, design, paper —
 * across the top of the editor. Any step can be opened at any time; the ones before the
 * current step read as passed, the rest as ahead. Phones and tablets keep the bottom bar.
 */
export const EditorSteps: FC = () => {
  const t = useTranslations('Editor')
  const tab = useEditorUiStore.use.tab()
  const openTab = useEditorUiStore.use.openTab()
  const current = EDITOR_TABS.indexOf(tab)

  return (
    <nav
      className='hidden h-14 shrink-0 items-center justify-center border-b border-line bg-surface px-4 lg:flex'
      aria-label={t('steps.label')}
    >
      <ol className='m-0 flex list-none items-center p-0'>
        {EDITOR_TABS.map((key, index) => {
          const active = index === current
          const passed = index < current
          return (
            <Fragment key={key}>
              {index > 0 && (
                <li
                  aria-hidden='true'
                  className={cn('mx-1 flex w-9 items-center transition-colors xl:mx-2 xl:w-16', index <= current ? 'text-accent' : 'text-muted/40')}
                >
                  <StepConnector done={index <= current} />
                </li>
              )}
              <li>
                <button
                  type='button'
                  aria-current={active ? 'step' : undefined}
                  onClick={() => openTab(key)}
                  className={cn(
                    'flex cursor-pointer items-center gap-2.5 rounded-full border-0 py-1 pr-4 pl-1 transition-colors',
                    active ? 'bg-accent-soft shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--brand-accent)_35%,transparent)]' : 'bg-transparent hover:bg-canvas'
                  )}
                >
                  <span
                    className={cn(
                      'grid size-8 shrink-0 place-items-center rounded-full text-sm font-semibold tabular-nums transition-colors',
                      active && 'bg-ink text-white shadow-md',
                      passed && 'bg-accent text-white',
                      !active && !passed && 'bg-canvas text-muted shadow-[inset_0_0_0_1px_var(--brand-border)]'
                    )}
                  >
                    {index + 1}
                  </span>
                  <span className={cn('flex items-center gap-1.5 text-sm whitespace-nowrap', active ? 'font-semibold text-ink' : passed ? 'text-text' : 'text-muted')}>
                    <span className={cn('text-base leading-none', active ? 'text-accent-strong' : 'opacity-70')}>{TAB_ICONS[key]}</span>
                    {t(`tabs.${key}`)}
                  </span>
                </button>
              </li>
            </Fragment>
          )
        })}
      </ol>
    </nav>
  )
}
