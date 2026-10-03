import { defineStore } from 'pinia'
import { ref } from 'vue'
import { listStaff, type StaffDto } from './staff.service'

export const useStaffStore = defineStore('staff', () => {
  const items = ref<StaffDto[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const loaded = ref(false)
  let requestId = 0

  /** Always re-reads: the list is admin-only, small, and never served from cache. */
  async function load(): Promise<void> {
    const id = ++requestId
    loading.value = true
    error.value = null
    try {
      const rows = await listStaff()
      if (id !== requestId) return
      items.value = rows
      loaded.value = true
    } catch {
      if (id !== requestId) return
      error.value = 'ไม่สามารถโหลดรายชื่อพนักงานได้'
    } finally {
      if (id === requestId) loading.value = false
    }
  }

  function upsert(row: StaffDto): void {
    items.value = items.value.some((item) => item.staffId === row.staffId)
      ? items.value.map((item) => (item.staffId === row.staffId ? row : item))
      : [...items.value, row]
  }

  function reset(): void {
    requestId += 1
    items.value = []
    loaded.value = false
    loading.value = false
    error.value = null
  }

  return { items, loading, error, loaded, load, upsert, reset }
})
