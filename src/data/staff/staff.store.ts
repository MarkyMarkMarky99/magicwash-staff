import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getStaffSecretary, setStaffSecretaryActive, listStaff, listStaffDirectory, type StaffSecretary, type StaffDirectoryEntry, type StaffDto } from './staff.service'

export const useStaffStore = defineStore('staff', () => {
  const items = ref<StaffDto[]>([])
  const assistants = ref(new Map<string, StaffDirectoryEntry>())
  const loading = ref(false)
  const error = ref<string | null>(null)
  const loaded = ref(false)
  let requestId = 0
  let assistantRevision = 0
  let sessionVersion = 0
  const secretaryRequests = new Map<string, number>()

  /** Always re-reads the roster and directory. */
  async function load(): Promise<void> {
    const id = ++requestId
    const revision = assistantRevision
    loading.value = true
    error.value = null
    try {
      const [roster, directory] = await Promise.allSettled([listStaff(), listStaffDirectory()])
      if (id !== requestId) return
      if (revision === assistantRevision && directory.status === 'fulfilled') {
        const counts = new Map<string, number>()
        for (const row of directory.value) counts.set(row.staffId, (counts.get(row.staffId) ?? 0) + 1)
        assistants.value = new Map(directory.value.filter((row) => row.role === 'assistant').map((row) => [
          row.staffId, { ...row, active: row.active && counts.get(row.staffId) === 1 },
        ]))
      } else if (revision === assistantRevision) {
        assistants.value = new Map([...assistants.value].map(([id, row]) => [id, { ...row, active: false }]))
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

  function hasActiveSecretary(staffId: string | null | undefined): boolean {
    return !!staffId && assistants.value.get(`AI-${staffId}`)?.active === true
  }

  function applySecretary(row: StaffSecretary): void {
    assistantRevision += 1
    if (!row.exists) {
      assistants.value.delete(row.assistantId)
      return
    }
    const previous = assistants.value.get(row.assistantId)
    assistants.value.set(row.assistantId, {
      staffId: row.assistantId, name: previous?.name ?? `เลขาของ ${nameOf(row.staffId)}`,
      role: 'assistant', active: row.active, departments: previous?.departments ?? [],
    })
  }

  async function requestSecretary(staffId: string, active?: boolean): Promise<StaffSecretary> {
    const version = sessionVersion
    const request = (secretaryRequests.get(staffId) ?? 0) + 1
    secretaryRequests.set(staffId, request)
    const row = active === undefined ? await getStaffSecretary(staffId) : await setStaffSecretaryActive(staffId, active)
    if (version === sessionVersion && secretaryRequests.get(staffId) === request) applySecretary(row)
    return row
  }

  function readSecretary(staffId: string): Promise<StaffSecretary> {
    return requestSecretary(staffId)
  }

  function enableSecretary(staffId: string): Promise<StaffSecretary> {
    return requestSecretary(staffId, true)
  }

  function disableSecretary(staffId: string): Promise<StaffSecretary> {
    return requestSecretary(staffId, false)
  }

  function upsert(row: StaffDto): void {
    if (row.role === 'assistant') return
    items.value = items.value.some((item) => item.staffId === row.staffId)
      ? items.value.map((item) => (item.staffId === row.staffId ? row : item))
      : [...items.value, row]
  }

  function reset(): void {
    sessionVersion += 1
    secretaryRequests.clear()
    assistantRevision += 1
    requestId += 1
    items.value = []
    assistants.value = new Map()
    loaded.value = false
    loading.value = false
    error.value = null
  }

  return { items, loading, error, loaded, load, nameOf, isAssistant, hasActiveSecretary, readSecretary, enableSecretary, disableSecretary, upsert, reset }
})
