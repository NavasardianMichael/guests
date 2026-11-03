import { create } from 'zustand'
import { combine } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { getMeAPI, loginAPI, logoutAPI, registerAPI } from '@api/auth/main'
import { appendSelectors } from '@store/appendSelectors'
import { trackEvent } from '@helpers/analytics'
import { processError } from '@helpers/error'
import type { AuthActions, AuthState } from './types'

const initialState: AuthState = {
  user: null,
  isResolved: false,
  isPending: false,
  error: null,
}

/**
 * Every async action resets `isPending` in a `finally`: a rejected request must never leave
 * the sign-in buttons disabled. The rejection itself is rethrown to the form that shows it.
 */
export const useAuthStoreBase = create<AuthState & AuthActions>()(
  immer(
    combine(
      initialState,
      (set): AuthActions => ({
        setUser: (user) => {
          set((state) => ({ ...state, user, isResolved: true }))
        },
        getMe: async () => {
          try {
            const user = await getMeAPI()
            set((state) => ({ ...state, user, isResolved: true, error: null }))
            return user
          } catch (error) {
            set((state) => ({ ...state, user: null, isResolved: true, error: processError(error) }))
            return null
          }
        },
        login: async (payload) => {
          set({ isPending: true, error: null })
          try {
            const user = await loginAPI(payload)
            set({ user, isResolved: true })
            trackEvent('login', { method: 'password' })
            return user
          } finally {
            set({ isPending: false })
          }
        },
        register: async (payload) => {
          set({ isPending: true, error: null })
          try {
            const result = await registerAPI(payload)
            trackEvent('sign_up', { method: 'password' })
            return result
          } finally {
            set({ isPending: false })
          }
        },
        logout: async () => {
          set({ isPending: true })
          try {
            await logoutAPI()
            set({ user: null })
          } finally {
            set({ isPending: false })
          }
        },
      })
    )
  )
)

export const useAuthStore = appendSelectors(useAuthStoreBase)
