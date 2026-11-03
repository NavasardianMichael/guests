import type { Rule } from 'antd/es/form'
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '@constants/auth'

/** Mirrors `validatePassword` in `server/src/lib/password.ts`, so the form says it before the API does. */
export const passwordRules = (requiredMessage: string, weakMessage: string): Rule[] => [
  { required: true, message: requiredMessage },
  {
    validator: (_rule, value: string | undefined) =>
      !value ||
      (value.length >= PASSWORD_MIN_LENGTH && value.length <= PASSWORD_MAX_LENGTH && /[a-zA-Z]/.test(value) && /\d/.test(value))
        ? Promise.resolve()
        : Promise.reject(new Error(weakMessage)),
  },
]

/** The repeat field: equal to `field`. The item must list `field` in `dependencies` to recheck as it changes. */
export const confirmPasswordRules = (field: string, requiredMessage: string, mismatchMessage: string): Rule[] => [
  { required: true, message: requiredMessage },
  ({ getFieldValue }) => ({
    validator: (_rule, value: string | undefined) =>
      !value || value === getFieldValue(field) ? Promise.resolve() : Promise.reject(new Error(mismatchMessage)),
  }),
]
