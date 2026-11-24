import { defineStore } from 'pinia'
import { ref } from 'vue'
import { listStaff, listStaffDirectory, type StaffDirectoryEntry, type StaffDto } from './staff.service'

export const useStaffStore = defineStore('staff', () => {
  const items = ref<StaffDto[]>([])
  const assistants = ref(new Map<string, StaffDirectoryEntry>())
  const loading = ref(false)
  const error = ref<string | null>(null)
  const loaded = ref(false)
  let requestId = 0

  /** Always re-reads the roster and directory. */
  async function load(): Promise<void> {
    const id = ++requestId
    loading.value = true
    error.value = null
    try {
      const [roster, directory] = await Promise.allSettled([listStaff(), listStaffDirectory()])
      if (id !== requestId) return
      if (directory.status === 'fulfilled') {
        assistants.value = new Map(directory.value.filter((row) => row.role === 'assistant').map((row) => [row.staffId, row]))
      }
      if (roster.status === 'rejected') throw roster.reason
      items.value = roster.value.filter((row) => row.role !== 'assistant')
      loaded.value = true
    } catch {
      if (id !== requestId) return
      error.value = 'ไม่สามารถโหลดรายชื่อพนักงานได้'
    } finally {
      if (id === requestId) loading.value = false
    }
  }

  function nameOf(value: string | null | undefined): string {
    if (value == null) return ''
    return items.value.find((item) => item.staffId === value)?.name ?? assistants.value.get(value)?.name ?? value
  }

  function isAssistant(staffId: string): boolean {
    return assistants.value.has(staffId)
  }

  function upsert(row: StaffDto): void {
    if (row.role === 'assistant') return
    items.value = items.value.some((item) => item.staffId === row.staffId)
      ? items.value.map((item) => (item.staffId === row.staffId ? row : item))
      : [...items.value, row]
  }

  function reset(): void {
    requestId += 1
    items.value = []
    assistants.value = new Map()
    loaded.value = false
    loading.value = false
    error.value = null
  }

  return { items, loading, error, loaded, load, nameOf, isAssistant, upsert, reset }
})
