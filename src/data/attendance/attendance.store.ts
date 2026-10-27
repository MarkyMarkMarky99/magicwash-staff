import { defineStore } from 'pinia'
import { onScopeDispose, ref } from 'vue'
import { onCacheInvalidated } from '@/shared/api/response-cache'
import { bookAttendanceDayOff, listAttendance, type AttendanceDto } from './attendance.service'

export const useAttendanceStore = defineStore('attendance', () => {
  const items = ref<AttendanceDto[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  let weeks: string[] = []
  let sequence = 0
  let inFlight: Promise<void> | null = null

  function load(visibleWeeks: readonly string[]): Promise<void> {
    weeks = [...visibleWeeks]
    const request = ++sequence
    loading.value = true
    error.value = null
    inFlight = (async () => {
      try {
        const results = await Promise.all(weeks.map(listAttendance))
        if (request === sequence) items.value = results.flat()
      } catch (reason) {
        if (request === sequence) {
          error.value = reason instanceof Error ? reason.message : 'Could not load attendance.'
        }
      } finally {
        if (request === sequence) {
          loading.value = false
          inFlight = null
        }
      }
    })()
    return inFlight
  }

  async function book(workDate: string): Promise<AttendanceDto> {
    const row = await bookAttendanceDayOff({ workDate })
    await inFlight
    items.value = items.value.some(item => item.id === row.id)
      ? items.value.map(item => item.id === row.id ? row : item)
      : [...items.value, row]
    return row
  }

  onScopeDispose(onCacheInvalidated('/api/attendance', () => {
    if (weeks.length > 0) void load(weeks)
  }))

  return { items, loading, error, load, book }
})
