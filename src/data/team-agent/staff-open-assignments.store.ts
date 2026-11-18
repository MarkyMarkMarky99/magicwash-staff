import { defineStore } from 'pinia'
import { ref } from 'vue'
import { fetchPersonalAssignments, type TeamAgentAssignment } from './team-agent.service'

/**
 * Open assignments of one staff member, for the staff profile. Admins pass the profile's staffId; a
 * staff viewer passes `null` and the gateway returns their own (it rejects another staff's id).
 */
export const useStaffOpenAssignmentsStore = defineStore('staff-open-assignments', () => {
  const items = ref<TeamAgentAssignment[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  let requestId = 0

  async function load(staffId: string | null): Promise<void> {
    const id = ++requestId
    loading.value = true
    error.value = null
    try {
      const rows = await fetchPersonalAssignments('open', staffId ?? undefined)
      if (id !== requestId) return
      items.value = rows
    } catch {
      if (id !== requestId) return
      items.value = []
      error.value = 'Could not load assignments'
    } finally {
      if (id === requestId) loading.value = false
    }
  }

  function reset(): void {
    requestId += 1
    items.value = []
    loading.value = false
    error.value = null
  }

  return { items, loading, error, load, reset }
})
