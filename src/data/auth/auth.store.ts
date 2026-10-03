import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import type { User } from 'firebase/auth'
import { getCurrentStaff, type StaffSession } from './auth.service'
import { getMyStaff, type StaffDto } from '@/data/staff/staff.service'
import { setSignedInStaffId } from '@/shared/config/actor'
import { ApiError } from '@/shared/api/api-client'
import { onUserChanged, signInWithGoogle, signOutUser } from '@/shared/api/firebase-auth'

/**
 * `unregistered`: Google session kept, no Staff row yet (must register).
 * `pending`: Staff row exists but is not approved (no role or inactive); not signed in as staff.
 */
export type AuthStatus = 'loading' | 'signedOut' | 'signedIn' | 'unregistered' | 'pending'

const CANCELLED_SIGN_IN_CODES = new Set(['auth/popup-closed-by-user', 'auth/cancelled-popup-request'])

export const useAuthStore = defineStore('auth', () => {
  const status = ref<AuthStatus>('loading')
  const staff = ref<StaffSession | null>(null)
  watch(staff, () => setSignedInStaffId(staff.value?.staffId ?? null), { immediate: true, flush: 'sync' })
  const pendingStaff = ref<StaffDto | null>(null)
  const email = ref<string | null>(null)
  const error = ref<string | null>(null)
  const signingIn = ref(false)
  const isAdmin = computed(() => status.value === 'signedIn' && staff.value?.role === 'admin')
  let started = false
  let sequence = 0
  let currentUser: User | null = null
  let resolveReady: () => void = () => undefined
  const readyPromise = new Promise<void>((resolve) => {
    resolveReady = resolve
  })

  async function rejectUser(message: string): Promise<void> {
    error.value = message
    await signOutUser()
  }

  async function applyUser(user: User | null): Promise<void> {
    const id = ++sequence
    currentUser = user
    if (user === null) {
      staff.value = null
      pendingStaff.value = null
      email.value = null
      status.value = 'signedOut'
      resolveReady()
      return
    }

    email.value = user.email
    staff.value = null
    status.value = 'loading'
    try {
      const session = await getCurrentStaff()
      if (id !== sequence) return
      staff.value = session
      pendingStaff.value = null
      error.value = null
      status.value = 'signedIn'
      resolveReady()
    } catch (reason) {
      if (id !== sequence) return
      if (reason instanceof ApiError && reason.status === 403) {
        await resolveForbiddenUser(user, id)
        return
      }
      await rejectUser('ตรวจสอบสิทธิ์ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง')
    }
  }

  /** A 403 from /api/auth/me means "not allowed in yet": find out whether to register or wait. */
  async function resolveForbiddenUser(user: User, id: number): Promise<void> {
    try {
      const row = await getMyStaff()
      if (id !== sequence) return
      if (row.active && row.role !== null) {
        await rejectUser(`บัญชี ${user.email ?? ''} ไม่มีสิทธิ์ใช้งานระบบนี้`)
        return
      }
      markPending(row)
    } catch (reason) {
      if (id !== sequence) return
      if (reason instanceof ApiError && reason.status === 404) {
        staff.value = null
        pendingStaff.value = null
        error.value = null
        status.value = 'unregistered'
        resolveReady()
        return
      }
      await rejectUser('ตรวจสอบสิทธิ์ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง')
    }
  }

  /** Enters the pending-approval state for a Staff row that is not yet usable. */
  function markPending(row: StaffDto): void {
    sequence += 1
    staff.value = null
    pendingStaff.value = row
    error.value = null
    status.value = 'pending'
    resolveReady()
  }

  /** Re-runs the session check for the current Google user. */
  async function recheck(): Promise<void> {
    if (currentUser !== null) await applyUser(currentUser)
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

  return {
    status,
    staff,
    pendingStaff,
    email,
    error,
    signingIn,
    isAdmin,
    ready,
    signIn,
    signOut,
    markPending,
    recheck,
  }
})
