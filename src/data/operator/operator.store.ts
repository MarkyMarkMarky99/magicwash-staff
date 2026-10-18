import { defineStore } from 'pinia'
import { onScopeDispose, ref, watch } from 'vue'
import { z } from 'zod'
import { authCardResponseSchema } from '@contracts/auth/auth-api.schema'
import { apiGet, ApiError } from '@/shared/api/api-client'
import { setOperator } from '@/shared/config/actor'

const STORAGE_KEY = 'staff-operator'
const EXPIRY_MS = 60 * 60 * 1000
const storedOperatorSchema = authCardResponseSchema.extend({ scannedAt: z.number().finite().nonnegative() })

export const useOperatorStore = defineStore('operator', () => {
  const staffId = ref<string | null>(null)
  const name = ref<string | null>(null)
  const scannedAt = ref<number | null>(null)
  const notice = ref<string | null>(null)
  let scanSequence = 0
  let expiryTimer: ReturnType<typeof setTimeout> | undefined

  function clear(): void {
    scanSequence += 1
    staffId.value = null
    name.value = null
    scannedAt.value = null
    notice.value = null
    setOperator(null)
    try { localStorage.removeItem(STORAGE_KEY) } catch {}
  }

  function checkExpiry(): void {
    if (scannedAt.value !== null && Date.now() >= scannedAt.value + EXPIRY_MS) clear()
  }

  watch([staffId, name, scannedAt], () => {
    setOperator(staffId.value && name.value !== null ? { staffId: staffId.value, name: name.value } : null)
    if (expiryTimer !== undefined) clearTimeout(expiryTimer)
    if (scannedAt.value !== null) expiryTimer = setTimeout(checkExpiry, Math.max(0, scannedAt.value + EXPIRY_MS - Date.now()))
    try {
      if (staffId.value === null) localStorage.removeItem(STORAGE_KEY)
      else localStorage.setItem(STORAGE_KEY, JSON.stringify({ staffId: staffId.value, name: name.value, scannedAt: scannedAt.value }))
    } catch {}
  }, { flush: 'sync' })

  try {
    const stored = storedOperatorSchema.safeParse(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null'))
    if (stored.success && Date.now() < stored.data.scannedAt + EXPIRY_MS) {
      staffId.value = stored.data.staffId
      name.value = stored.data.name
      scannedAt.value = stored.data.scannedAt
    } else clear()
  } catch { clear() }
  setOperator(staffId.value !== null && name.value !== null ? { staffId: staffId.value, name: name.value } : null)
  const interval = setInterval(checkExpiry, 30_000)
  onScopeDispose(() => {
    clearInterval(interval)
    if (expiryTimer !== undefined) clearTimeout(expiryTimer)
  })

  async function scanCard(code: string): Promise<void> {
    const sequence = ++scanSequence
    notice.value = null
    try {
      const operator = await apiGet<z.infer<typeof authCardResponseSchema>>(`/api/auth/card?code=${encodeURIComponent(code.trim())}`)
      if (sequence !== scanSequence) return
      staffId.value = operator.staffId
      name.value = operator.name
      scannedAt.value = Date.now()
    } catch (error) {
      if (sequence !== scanSequence) return
      notice.value = error instanceof ApiError && error.status === 404 ? 'ไม่พบบัตรพนักงานนี้' : 'ตรวจสอบบัตรไม่สำเร็จ กรุณาลองใหม่อีกครั้ง'
    }
  }

  return { staffId, name, scannedAt, notice, scanCard, clear }
})
