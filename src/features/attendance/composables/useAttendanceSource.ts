import { computed, ref } from 'vue'
import type { ComputedRef, Ref } from 'vue'
import { storeToRefs } from 'pinia'
import { bangkokToday } from '@shared/utils/bangkok-datetime'
import { ApiError } from '@/shared/api/api-client'
import { useAttendanceStore } from '@/data/attendance/attendance.store'
import { useAuthStore } from '@/data/auth/auth.store'
import { useOperatorStore } from '@/data/operator/operator.store'
import { useStaffStore } from '@/data/staff/staff.store'
import type { AttendanceRow } from '../attendance.types'
import { addDays, mondayOf, WEEKS_SHOWN } from '../utils/attendance-calendar'
import { weekdayName } from '../utils/attendance-labels'

export interface AttendanceSource {
  today: Ref<string>
  rows: Ref<AttendanceRow[]>
  meStaffId: ComputedRef<string | null>
  loading: Ref<boolean>
  error: Ref<string | null>
  staffName: (staffId: string) => string
  reload: () => Promise<void>
  book: (workDate: string) => Promise<AttendanceRow>
}

export function useAttendanceSource(): AttendanceSource {
  const attendanceStore = useAttendanceStore()
  const authStore = useAuthStore()
  const operatorStore = useOperatorStore()
  const staffStore = useStaffStore()
  const today = ref(bangkokToday())
  const { items: rows, loading, error } = storeToRefs(attendanceStore)
  const meStaffId = computed<string | null>(() => {
    if (authStore.status !== 'signedIn') return null
    return authStore.staff?.role === 'device' ? operatorStore.staffId : authStore.staff?.staffId ?? null
  })

  async function reload(): Promise<void> {
    today.value = bangkokToday()
    const monday = mondayOf(today.value)
    await attendanceStore.load(Array.from({ length: WEEKS_SHOWN }, (_, index) => addDays(monday, index * 7)))
  }

  async function book(workDate: string): Promise<AttendanceRow> {
    const bookingStaffId = meStaffId.value
    try {
      return await attendanceStore.book(workDate)
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 409) {
        await reload()
        const holder = error.value === null
          ? rows.value.find(row => row.workDate === workDate && row.status === 'DAY_OFF' && row.staffId !== bookingStaffId)
          : undefined
        if (holder) {
          throw new ApiError(`${staffStore.nameOf(holder.staffId)} just took ${weekdayName(workDate)}. Pick another day.`, reason.status, reason.code)
        }
      }
      throw reason
    }
  }

  return { today, rows, meStaffId, loading, error, staffName: staffStore.nameOf, reload, book }
}
