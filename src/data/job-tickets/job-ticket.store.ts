import { defineStore } from 'pinia'
import { computed, onScopeDispose, ref, reactive } from 'vue'
import type { JobTicketCompleteOrderPayload, JobTicketAdvancePayload, JobTicketListQuery, JobTicketStartOrderPayload, JobTicketDto } from './job-ticket.service'
import { completeJobTicketOrder, advanceJobTickets, listJobTickets, loadDepartmentWork, MAX_DEPARTMENT_TICKETS, startJobTicketOrder } from './job-ticket.service'
import { onCacheInvalidated } from '@/shared/api/response-cache'

const DEPARTMENT_WORK_FRESH_MS = 60 * 60 * 1000

type Department = JobTicketListQuery['department'] & string
type DepartmentView = { ids: string[]; loaded: boolean; loadedAt: number; stale: boolean; loading: boolean; error: string | null; requestId: number }

type TicketView = { ids: string[]; loaded: boolean; loading: boolean; error: string | null; truncated: boolean; requestId: number }

export const useJobTicketStore = defineStore('job-tickets', () => {
  const rows = ref(new Map<string, JobTicketDto>())
  const orders = reactive(new Map<string, TicketView>())
  const departments = reactive(new Map<Department, DepartmentView>())
  const departmentPromises = new Map<Department, { id: number; promise: Promise<void> }>()
  const activeDepartment = ref<Department>()
  const activeOrders = new Map<string, { orderId: string; department: Department | undefined; users: number }>()
  const departmentRows = computed(() => {
    if (!activeDepartment.value) return []
    return (departments.get(activeDepartment.value)?.ids ?? []).flatMap(id => {
      const row = rows.value.get(id)
      return row && row.department === activeDepartment.value ? [row] : []
    })
  })
  const tickets = computed(() => departmentRows.value.slice(0, MAX_DEPARTMENT_TICKETS))
  // Loaded work keeps showing while it refreshes; only the first load blocks the page.
  const activeState = computed(() => activeDepartment.value ? departments.get(activeDepartment.value) : undefined)
  const loading = computed(() => !!activeState.value?.loading && !activeState.value.loaded)
  const error = computed(() => activeState.value?.error ?? null)
  const truncated = computed(() => departmentRows.value.length >= MAX_DEPARTMENT_TICKETS)

  function departmentView(department: Department): DepartmentView {
    if (!departments.has(department)) departments.set(department, { ids: [], loaded: false, loadedAt: 0, stale: false, loading: false, error: null, requestId: 0 })
    return departments.get(department)!
  }

  function view(views: Map<string | undefined, TicketView>, key: string | undefined): TicketView {
    if (!views.has(key)) views.set(key, { ids: [], loaded: false, loading: false, error: null, truncated: false, requestId: 0 })
    return views.get(key)!
  }

  function merge(tickets: JobTicketDto[]): void {
    for (const ticket of tickets) rows.value.set(ticket.id, ticket)
  }

  function invalidate(state: DepartmentView): void {
    state.stale = true
    state.loading = false
    state.requestId += 1
  }

  function isFresh(state: DepartmentView): boolean {
    return state.loaded && !state.stale && Date.now() - state.loadedAt < DEPARTMENT_WORK_FRESH_MS
  }

  async function loadDepartmentState(department: Department, state: DepartmentView): Promise<void> {
    if (isFresh(state)) return
    const inFlight = departmentPromises.get(department)
    if (inFlight) {
      if (inFlight.id === state.requestId) return inFlight.promise
      await inFlight.promise
      return loadDepartmentState(department, state)
    }
    const id = ++state.requestId
    state.loading = true
    state.error = null
    const promise = (async () => {
      try {
        const tickets = await loadDepartmentWork(department)
        if (id !== state.requestId) return
        merge(tickets)
        state.ids = tickets.map(ticket => ticket.id)
        state.loaded = true
        state.loadedAt = Date.now()
        state.stale = false
      } catch (reason) {
        if (id === state.requestId) state.error = reason instanceof Error ? reason.message : 'โหลดรายการงานไม่สำเร็จ'
      } finally {
        if (id === state.requestId) state.loading = false
        if (departmentPromises.get(department)?.id === id) departmentPromises.delete(department)
      }
    })()
    departmentPromises.set(department, { id, promise })
    return promise
  }

  async function loadDepartment(department: Department, forceReload = false): Promise<void> {
    activeDepartment.value = department
    const state = departmentView(department)
    if (forceReload) invalidate(state)
    await loadDepartmentState(department, state)
  }

  function activateDepartment(department: Department): void {
    activeDepartment.value = department
    const state = departmentView(department)
    if (!isFresh(state) && departmentPromises.get(department)?.id !== state.requestId) void loadDepartment(department)
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

  async function completeOrder(payload: JobTicketCompleteOrderPayload) {
    const result = await completeJobTicketOrder(payload)
    if (result.kind === 'completed') {
      for (const completed of result.completed) {
        const ticket = rows.value.get(completed.ticketId)
        if (ticket) {
          ticket.status = completed.status
          ticket.startedAt = completed.startedAt
          ticket.completedAt = completed.completedAt
          ticket.scannedBy = result.scannedBy
          ticket.updatedBy = result.scannedBy
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
    for (const state of departments.values()) invalidate(state)
    if (activeDepartment.value) void loadDepartment(activeDepartment.value)
    for (const active of activeOrders.values()) void loadOrder(active.orderId, active.department).catch(() => {})
  })
  onScopeDispose(stopInvalidationListener)

  return { rows, tickets, loading, error, truncated, loadDepartment, activateDepartment, releaseDepartment, orderTickets, orderView, loadOrder, retainOrder, startOrder, completeOrder, advanceTickets }
})
