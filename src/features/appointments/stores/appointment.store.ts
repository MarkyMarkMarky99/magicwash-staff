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

// Reconcile views from write responses because GViz reads may lag.
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
      const items = await listAppointmentsForDate(date)
      if (request !== dailyRequest) return

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

/**
 * One request: the API filters by date at the sheet, so the client neither pages
 * nor date-filters. The rows still need normalizing because GViz returns a native
 * date cell in its `Date(Y,M,D)` wire format.
 */
async function listAppointmentsForDate(date: string): Promise<AppointmentListDto[]> {
  const result = await listAppointments({
    appointmentDate: date,
    perPage: MAX_LIST_SIZE,
  })

  return normalizeAppointmentItems(result.items)
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
