import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import {
  createAppointment,
  listAppointments,
  updateAppointment,
  type AppointmentCreateDto,
  type AppointmentListDto,
  type AppointmentUpdateDto,
} from '../services/appointment.service'
import { normalizeSheetDate } from '@/shared/utils/sheet-date'
import { toAppointmentDate } from '../utils/appointment-date'

type AppointmentItem = AppointmentListDto | AppointmentCreateDto | AppointmentUpdateDto

const MAX_LIST_SIZE = 100

/**
 * Shared appointment read model for schedule and pending views. Every mutation
 * uses the persisted write response, rather than reading GViz immediately after
 * a write (the sheet's read path can lag behind it).
 */
export const useAppointmentStore = defineStore('appointments', () => {
  const selectedDate = ref(toAppointmentDate(new Date()))
  const dailyItems = ref<AppointmentListDto[]>([])
  const pendingItems = ref<AppointmentListDto[]>([])
  const dailyLoading = ref(false)
  const pendingLoading = ref(false)
  const error = ref<string | null>(null)
  const pendingCount = computed(() => pendingItems.value.length)
  const loading = computed(() => dailyLoading.value || pendingLoading.value)

  let loadedDate: string | null = null
  let loadingDate: string | null = null
  let pendingLoaded = false
  let dailyRequest = 0
  let pendingRequest = 0

  async function loadInitial() {
    await Promise.all([loadDate(selectedDate.value), loadPending()])
  }

  async function loadDate(date = selectedDate.value, force = false) {
    selectedDate.value = date
    if (!force && (loadedDate === date || (dailyLoading.value && loadingDate === date))) return

    const request = ++dailyRequest
    dailyLoading.value = true
    loadingDate = date
    error.value = null

    try {
      // TEMP(frontend): the backend date filter currently emits a GViz string
      // literal, so read sorted pages without appointmentDate and filter the
      // normalized date locally until the backend query builder is fixed.
      const items = await listAppointmentsForDate(date)
      if (request !== dailyRequest) return

      // Pending work belongs exclusively to the pending queue, matching the
      // existing schedule behaviour without reshaping API DTOs.
      dailyItems.value = items
        .filter((item) => item.status !== 'PENDING')
        .sort((left, right) => left.timeSlot.localeCompare(right.timeSlot))
      loadedDate = date
    } catch (reason) {
      if (request !== dailyRequest) return
      error.value = messageFor(reason, 'Unable to load appointments')
    } finally {
      if (request === dailyRequest) {
        dailyLoading.value = false
        loadingDate = null
      }
    }
  }

  async function loadPending(force = false) {
    if (!force && pendingLoaded) return

    const request = ++pendingRequest
    pendingLoading.value = true
    error.value = null

    try {
      const result = await listAppointments({
        status: 'PENDING',
        page: 1,
        perPage: MAX_LIST_SIZE,
        sortBy: 'appointmentDate',
        sortOrder: 'asc',
      })
      if (request !== pendingRequest) return

      pendingItems.value = normalizeAppointmentItems(result.items)
      pendingLoaded = true
    } catch (reason) {
      if (request !== pendingRequest) return
      error.value = messageFor(reason, 'Unable to load pending appointments')
    } finally {
      if (request === pendingRequest) pendingLoading.value = false
    }
  }

  async function refreshDate() {
    await loadDate(selectedDate.value, true)
  }

  async function updateStatus(appointmentId: string, status: AppointmentListDto['status']) {
    const persisted = await updateAppointment(appointmentId, { status })
    applyPersisted(persisted)
    return persisted
  }

  async function rescheduleAppointment(
    appointmentId: string,
    data: Pick<AppointmentListDto, 'appointmentDate' | 'timeSlot'> & { notes: string | null },
  ) {
    const persisted = await updateAppointment(appointmentId, {
      ...data,
      status: 'PENDING',
    })
    applyPersisted(persisted)
    return persisted
  }

  async function createNewAppointment(data: Parameters<typeof createAppointment>[0]) {
    const persisted = await createAppointment(data)
    applyPersisted(persisted)
    return persisted
  }

  function applyPersisted(persisted: AppointmentItem) {
    const normalized = normalizeAppointmentItem(persisted)
    dailyItems.value = reconcileDaily(dailyItems.value, normalized, selectedDate.value)
    pendingItems.value = reconcilePending(pendingItems.value, normalized)
  }

  return {
    selectedDate,
    dailyItems,
    pendingItems,
    loading,
    error,
    pendingCount,
    loadInitial,
    loadDate,
    loadPending,
    refreshDate,
    updateStatus,
    rescheduleAppointment,
    createNewAppointment,
  }
})

async function listAppointmentsForDate(date: string): Promise<AppointmentListDto[]> {
  const matches: AppointmentListDto[] = []
  let page = 1

  while (true) {
    const result = await listAppointments({
      page,
      perPage: MAX_LIST_SIZE,
      sortBy: 'appointmentDate',
      sortOrder: 'asc',
    })
    const normalizedItems = normalizeAppointmentItems(result.items)

    matches.push(...normalizedItems.filter((item) => item.appointmentDate === date))

    const reachedEnd = result.items.length < MAX_LIST_SIZE
    const passedDate = normalizedItems.some((item) => {
      const itemDate = normalizeSheetDate(item.appointmentDate)
      return itemDate !== null && itemDate > date
    })
    if (reachedEnd || passedDate) return matches

    page += 1
  }
}

function normalizeAppointmentItems(items: AppointmentListDto[]): AppointmentListDto[] {
  return items.map(normalizeAppointmentItem)
}

function normalizeAppointmentItem<T extends { appointmentDate: string }>(item: T): T {
  const appointmentDate = normalizeSheetDate(item.appointmentDate)
  if (!appointmentDate || appointmentDate === item.appointmentDate) return item

  return { ...item, appointmentDate }
}

function reconcileDaily(
  items: AppointmentListDto[],
  persisted: AppointmentItem,
  selectedDate: string,
): AppointmentListDto[] {
  const withoutPersisted = items.filter((item) => item.appointmentId !== persisted.appointmentId)
  if (persisted.appointmentDate !== selectedDate || persisted.status === 'PENDING') {
    return withoutPersisted
  }

  return [...withoutPersisted, persisted].sort((left, right) =>
    left.timeSlot.localeCompare(right.timeSlot),
  )
}

function reconcilePending(items: AppointmentListDto[], persisted: AppointmentItem): AppointmentListDto[] {
  const withoutPersisted = items.filter((item) => item.appointmentId !== persisted.appointmentId)
  if (persisted.status !== 'PENDING') return withoutPersisted

  return [...withoutPersisted, persisted].sort((left, right) => {
    const dateComparison = left.appointmentDate.localeCompare(right.appointmentDate)
    return dateComparison || left.timeSlot.localeCompare(right.timeSlot)
  })
}

function messageFor(reason: unknown, fallback: string): string {
  return reason instanceof Error && reason.message ? reason.message : fallback
}
