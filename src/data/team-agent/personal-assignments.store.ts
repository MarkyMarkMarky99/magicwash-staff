import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  cancelAssignment,
  fetchPersonalAssignments,
  type TeamAgentAssignment,
  type TeamAgentAssignmentStatus,
} from './team-agent.service'

function errorMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : 'Something went wrong. Try again.'
}

export const usePersonalAssignmentsStore = defineStore('personal-assignments', () => {
  const items = ref<TeamAgentAssignment[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const cancellingId = ref<string | null>(null)
  const cancelError = ref<string | null>(null)
  let requestId = 0

  async function load(status: TeamAgentAssignmentStatus): Promise<void> {
    const id = ++requestId
    loading.value = true
    error.value = null
    try {
      const rows = await fetchPersonalAssignments(status)
      if (id !== requestId) return
      items.value = rows
    } catch (reason) {
      if (id !== requestId) return
      items.value = []
      error.value = errorMessage(reason)
    } finally {
      if (id === requestId) loading.value = false
    }
  }

  async function cancel(id: string): Promise<boolean> {
    if (cancellingId.value !== null) return false
    cancellingId.value = id
    cancelError.value = null
    try {
      const updated = await cancelAssignment(id)
      items.value = items.value.map(item => (item.id === id ? updated : item))
      return true
    } catch (reason) {
      cancelError.value = errorMessage(reason)
      return false
    } finally {
      cancellingId.value = null
    }
  }

  function reset(): void {
    requestId += 1
    items.value = []
    loading.value = false
    error.value = null
    cancellingId.value = null
    cancelError.value = null
  }

  return { items, loading, error, cancellingId, cancelError, load, cancel, reset }
})
