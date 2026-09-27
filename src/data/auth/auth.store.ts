import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { User } from 'firebase/auth'
import { getCurrentStaff, type StaffSession } from './auth.service'
import { ApiError } from '@/shared/api/api-client'
import { onUserChanged, signInWithGoogle, signOutUser } from '@/shared/api/firebase-auth'

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn'

const CANCELLED_SIGN_IN_CODES = new Set(['auth/popup-closed-by-user', 'auth/cancelled-popup-request'])

export const useAuthStore = defineStore('auth', () => {
  const status = ref<AuthStatus>('loading')
  const staff = ref<StaffSession | null>(null)
  const error = ref<string | null>(null)
  const signingIn = ref(false)
  let started = false
  let sequence = 0
  let resolveReady: () => void = () => undefined
  const readyPromise = new Promise<void>((resolve) => {
    resolveReady = resolve
  })

  async function applyUser(user: User | null): Promise<void> {
    const id = ++sequence
    if (user === null) {
      staff.value = null
      status.value = 'signedOut'
      resolveReady()
      return
    }

    status.value = 'loading'
    try {
      const session = await getCurrentStaff()
      if (id !== sequence) return
      staff.value = session
      error.value = null
      status.value = 'signedIn'
      resolveReady()
    } catch (reason) {
      if (id !== sequence) return
      error.value = reason instanceof ApiError && reason.status === 403
        ? `บัญชี ${user.email ?? ''} ไม่มีสิทธิ์ใช้งานระบบนี้`
        : 'ตรวจสอบสิทธิ์ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง'
      await signOutUser()
    }
  }

  /** Starts listening to Firebase and resolves once the first session check has settled. */
  function ready(): Promise<void> {
    if (!started) {
      started = true
      onUserChanged((user) => void applyUser(user))
    }
    return readyPromise
  }

  async function signIn(): Promise<void> {
    if (signingIn.value) return
    error.value = null
    signingIn.value = true
    try {
      await signInWithGoogle()
    } catch (reason) {
      const code = (reason as { code?: unknown } | null)?.code
      if (typeof code !== 'string' || !CANCELLED_SIGN_IN_CODES.has(code)) {
        error.value = 'เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง'
      }
    } finally {
      signingIn.value = false
    }
  }

  async function signOut(): Promise<void> {
    error.value = null
    await signOutUser()
  }

  return { status, staff, error, signingIn, ready, signIn, signOut }
})
