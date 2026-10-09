import { defineStore } from 'pinia'
import { computed, onScopeDispose, ref, reactive } from 'vue'
import type { JobTicketAdvancePayload, JobTicketListQuery, JobTicketScanPayload, JobTicketStartOrderPayload, JobTicketDto } from './job-ticket.service'
import { advanceJobTickets, listJobTickets, loadOpenTickets, loadCompletedTickets, MAX_DEPARTMENT_TICKETS, scanJobTicket, startJobTicketOrder } from './job-ticket.service'
import { onCacheInvalidated } from '@/shared/api/response-cache'

type Department = JobTicketListQuery['department']
type TicketView = { ids: string[]; loading: boolean; error: string | null; truncated: boolean; requestId: number }

export const useJobTicketStore = defineStore('job-tickets', () => {
  const rows = ref(new Map<string, JobTicketDto>())
  const departments = reactive(new Map<Department, TicketView>())
  const orders = reactive(new Map<string, TicketView>())
  const openWork = reactive({ ids: [] as string[], loading: false, error: null as string | null, truncated: false, requestId: 0 })
  let openLoaded = false
  let openPromise: Promise<void> | undefined
  let openPromiseId = 0
  const activeDepartment = ref<Department>()
  const activeOrders = new Map<string, { orderId: string; department: Department; users: number }>()
  const departmentRows = computed(() => {
    if (!activeDepartment.value) return []
    const ids = new Set([...openWork.ids, ...(departments.get(activeDepartment.value)?.ids ?? [])])
    return [...ids].flatMap(id => {
      const row = rows.value.get(id)
      return row && row.department === activeDepartment.value ? [row] : []
    })
  })
  const tickets = computed(() => departmentRows.value.slice(0, MAX_DEPARTMENT_TICKETS))
  const loading = computed(() => openWork.loading || (departments.get(activeDepartment.value)?.loading ?? false))
  const error = computed(() => openWork.error ?? departments.get(activeDepartment.value)?.error ?? null)
  const truncated = computed(() => openWork.truncated || (departments.get(activeDepartment.value)?.truncated ?? false)
    || departmentRows.value.length >= MAX_DEPARTMENT_TICKETS)

  function view(views: Map<string | undefined, TicketView>, key: string | undefined): TicketView {
    if (!views.has(key)) views.set(key, { ids: [], loading: false, error: null, truncated: false, requestId: 0 })
    return views.get(key)!
  }

  function merge(tickets: JobTicketDto[]): void {
    for (const ticket of tickets) rows.value.set(ticket.id, ticket)
  }

  function invalidateOpenWork(): void {
    openLoaded = false
    openWork.loading = false
    openWork.requestId += 1
  }

  async function loadOpenWork(): Promise<void> {
    if (openLoaded) return
    if (openPromise) {
      if (openPromiseId === openWork.requestId) return openPromise
      await openPromise
      return loadOpenWork()
    }
    const id = ++openWork.requestId
    openPromiseId = id
    openWork.loading = true
    openWork.error = null
    openPromise = (async () => {
      try {
        const result = await loadOpenTickets()
        if (id !== openWork.requestId) return
        merge(result.tickets)
        openWork.ids = result.tickets.map(ticket => ticket.id)
        openWork.truncated = result.truncated
        openLoaded = true
      } catch (reason) {
        if (id === openWork.requestId) openWork.error = reason instanceof Error ? reason.message : 'โหลดรายการงานไม่สำเร็จ'
      } finally {
        if (id === openWork.requestId) openWork.loading = false
        if (id === openPromiseId) openPromise = undefined
      }
    })()
    return openPromise
  }

  async function loadDepartment(department: Department, forceOpen = false): Promise<void> {
    activeDepartment.value = department
    if (forceOpen) invalidateOpenWork()
    const state = view(departments, department)
    const id = ++state.requestId
    state.ids = []
    state.truncated = false
    state.loading = true
    state.error = null
    try {
      const [, result] = await Promise.all([loadOpenWork(), loadCompletedTickets(department)])
      if (id !== state.requestId) return
      merge(result.tickets)
      state.ids = result.tickets.map(ticket => ticket.id)
      state.truncated = result.truncated
    } catch (reason) {
      if (id === state.requestId) state.error = reason instanceof Error && reason.message ? reason.message : 'โหลดรายการงานไม่สำเร็จ'
    } finally {
      if (id === state.requestId) state.loading = false
    }
  }

  function activateDepartment(department: Department): void {
    activeDepartment.value = department
    if (!openLoaded && (!openPromise || openPromiseId !== openWork.requestId)) void loadDepartment(department)
  }

  function releaseDepartment(): void {
    activeDepartment.value = undefined
  }

  function orderKey(orderId: string, department?: Department): string {
    return JSON.stringify([orderId, department ?? null])
  }

  function orderView(orderId: string, department?: Department): TicketView {
    return view(orders, orderKey(orderId, department))
  }

  function orderTickets(orderId: string, department?: Department): JobTicketDto[] {
    const ids = new Set([...(orders.get(orderKey(orderId, department))?.ids ?? []), ...rows.value.keys()])
    return [...ids].flatMap(id => {
      const row = rows.value.get(id)
      return row && row.orderId === orderId && (!department || row.department === department) ? [row] : []
    })
  }

  async function loadOrder(orderId: string, department?: Department): Promise<void> {
    const state = orderView(orderId, department)
    const id = ++state.requestId
    state.loading = true
    state.error = null
    state.truncated = false
    try {
      const tickets: JobTicketDto[] = []
      for (let page = 1; ; page += 1) {
        const result = await listJobTickets({ orderId, department, page, perPage: 500 })
        if (id !== state.requestId) return
        tickets.push(...result.items)
        if (result.items.length < 500) break
      }
      merge(tickets)
      state.ids = tickets.map(ticket => ticket.id)
    } catch (reason) {
      if (id === state.requestId) state.error = reason instanceof Error ? reason.message : 'Unable to load tickets'
      throw reason
    } finally {
      if (id === state.requestId) state.loading = false
    }
  }

  function retainOrder(orderId: string, department?: Department): () => void {
    const key = orderKey(orderId, department)
    const active = activeOrders.get(key) ?? { orderId, department, users: 0 }
    active.users += 1
    activeOrders.set(key, active)
    let released = false
    return () => {
      if (released) return
      released = true
      active.users -= 1
      if (!active.users) activeOrders.delete(key)
    }
  }

  async function scan(payload: JobTicketScanPayload) {
    const result = await scanJobTicket(payload)
    if (result.kind === 'advanced') {
      const ticket = rows.value.get(result.ticketId)
      if (ticket) {
        ticket.status = result.status
        ticket.startedAt = result.startedAt
        ticket.completedAt = result.completedAt
        ticket.scannedBy = payload.scannedBy
      }
    }
    return result
  }

  async function startOrder(payload: JobTicketStartOrderPayload) {
    const result = await startJobTicketOrder(payload)
    if (result.kind === 'completed') {
      for (const advanced of result.advanced) {
        const ticket = rows.value.get(advanced.ticketId)
        if (ticket) {
          ticket.status = advanced.status
          ticket.startedAt = advanced.startedAt
          ticket.scannedBy = payload.scannedBy
        }
      }
    }
    return result
  }

  async function advanceTickets(payload: JobTicketAdvancePayload) {
    const result = await advanceJobTickets(payload)
    if (result.kind === 'completed') {
      for (const advanced of result.advanced) {
        const ticket = rows.value.get(advanced.ticketId)
        if (ticket) {
          ticket.status = advanced.status
          ticket.startedAt = advanced.startedAt
          ticket.completedAt = advanced.completedAt
          ticket.scannedBy = payload.scannedBy
        }
      }
    }
    return result
  }

  const stopInvalidationListener = onCacheInvalidated('/api/job-tickets', () => {
    invalidateOpenWork()
    if (activeDepartment.value) void loadDepartment(activeDepartment.value)
    for (const active of activeOrders.values()) void loadOrder(active.orderId, active.department).catch(() => {})
  })
  onScopeDispose(stopInvalidationListener)

  return { rows, tickets, loading, error, truncated, loadDepartment, activateDepartment, releaseDepartment, orderTickets, orderView, loadOrder, retainOrder, scan, startOrder, advanceTickets }
})
