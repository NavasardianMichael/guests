'use client'

import type { FC, InputHTMLAttributes } from 'react'
import {
  ColorPicker,
  type ColorPickerProps,
  Input,
  InputNumber,
  type InputNumberProps,
  type InputProps,
  Slider,
  type SliderSingleProps,
} from 'antd'
import { useThrottledDraft } from '@hooks/useThrottledDraft'

/**
 * The editor's form controls for document values, as antd's (or a native input) but writing
 * to the document through `useThrottledDraft`: the control follows the pointer or the keys at
 * once, the sheet updates at most five times a second, and the last value always lands
 * (on release, blur, Enter or when the control goes away).
 */

/** antd's colour object, as its picker hands it over. */
type PickerColor = Parameters<NonNullable<ColorPickerProps['onChangeComplete']>>[0]

const toHex = (color: PickerColor | string): string => (typeof color === 'string' ? color : color.toHexString().slice(0, 7))

type ColorProps = Omit<ColorPickerProps, 'value' | 'onChange' | 'onChangeComplete' | 'disabledAlpha'> & {
  /** `#rrggbb`, as the document stores it (the API accepts six-digit hex only). */
  value: string
  onChange: (hex: string) => void
}

/**
 * A colour picker. While dragging it keeps antd's own colour object, not the hex: a hex has no
 * hue once it is grey, and the hue slider would jump back to red under the pointer.
 */
export const LiveColorPicker: FC<ColorProps> = ({ value, onChange, onOpenChange, ...rest }) => {
  const { shown, change, flush } = useThrottledDraft<PickerColor | string>(value, (next) => {
    const hex = toHex(next)
    if (hex !== value) onChange(hex)
  })
  return (
    <ColorPicker
      {...rest}
      disabledAlpha
      value={shown}
      onChange={change}
      onChangeComplete={(color) => {
        change(color)
        flush()
      }}
      onOpenChange={(open) => {
        if (!open) flush()
        onOpenChange?.(open)
      }}
    />
  )
}

type SliderProps = Omit<SliderSingleProps, 'value' | 'onChange' | 'onChangeComplete' | 'range'> & {
  value: number
  onChange: (value: number) => void
}

export const LiveSlider: FC<SliderProps> = ({ value, onChange, ...rest }) => {
  const { shown, change, flush } = useThrottledDraft(value, (next) => next !== value && onChange(next))
  return (
    <Slider
      {...rest}
      value={shown}
      onChange={change}
      onChangeComplete={(next) => {
        change(next)
        flush()
      }}
    />
  )
}

type NumberProps = Omit<InputNumberProps<number>, 'value' | 'onChange'> & {
  value: number
  /** Called with numbers only: an emptied field writes nothing, and shows the document's value on blur. */
  onChange: (value: number) => void
}

export const LiveInputNumber: FC<NumberProps> = ({ value, onChange, onBlur, onPressEnter, ...rest }) => {
  const { shown, change, flush } = useThrottledDraft<number | null>(value, (next) => {
    if (next !== null && next !== value) onChange(next)
  })
  return (
    <InputNumber<number>
      {...rest}
      value={shown}
      onChange={change}
      onBlur={(event) => {
        flush()
        onBlur?.(event)
      }}
      onPressEnter={(event) => {
        flush()
        onPressEnter?.(event)
      }}
    />
  )
}

type TextProps = Omit<InputProps, 'value' | 'onChange'> & {
  value: string
  onChange: (value: string) => void
}

export const LiveInput: FC<TextProps> = ({ value, onChange, onBlur, ...rest }) => {
  const { shown, change, flush } = useThrottledDraft(value, (next) => next !== value && onChange(next))
  return (
    <Input
      {...rest}
      value={shown}
      onChange={(event) => change(event.target.value)}
      onBlur={(event) => {
        flush()
        onBlur?.(event)
      }}
    />
  )
}

type NativeTextProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  value: string
  onChange: (value: string) => void
}

/** A plain `<input>`, for the guest rows, which are many and must stay light. */
export const LiveTextInput: FC<NativeTextProps> = ({ value, onChange, onBlur, ...rest }) => {
  const { shown, change, flush } = useThrottledDraft(value, (next) => next !== value && onChange(next))
  return (
    <input
      {...rest}
      value={shown}
      onChange={(event) => change(event.target.value)}
      onBlur={(event) => {
        flush()
        onBlur?.(event)
      }}
    />
  )
}
