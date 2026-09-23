import { defineStore } from 'pinia'
import { onScopeDispose, ref } from 'vue'
import type { JobTicketListQuery } from './job-ticket.service'
import { loadDepartmentTickets, type JobTicketDto } from './job-ticket.service'
import { onCacheInvalidated } from '@/shared/api/response-cache'

export const useJobTicketStore = defineStore('job-tickets', () => {
  const tickets = ref<JobTicketDto[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const truncated = ref(false)
  let activeDepartment: JobTicketListQuery['department'] = undefined
  let requestId = 0

  async function loadDepartment(department: JobTicketListQuery['department']): Promise<void> {
    activeDepartment = department
    const id = ++requestId
    tickets.value = []
    truncated.value = false
    loading.value = true
    error.value = null
    try {
      const result = await loadDepartmentTickets(department)
      if (id !== requestId) return
      tickets.value = result.tickets
      truncated.value = result.truncated
    } catch (reason) {
      if (id !== requestId) return
      error.value = reason instanceof Error && reason.message ? reason.message : 'โหลดรายการงานไม่สำเร็จ'
    } finally {
      if (id === requestId) loading.value = false
    }
  }

  const stopInvalidationListener = onCacheInvalidated('/api/job-tickets', () => {
    if (activeDepartment) void loadDepartment(activeDepartment)
  })
  onScopeDispose(stopInvalidationListener)

  return { tickets, loading, error, truncated, loadDepartment }
})
