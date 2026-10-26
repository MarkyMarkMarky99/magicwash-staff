import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { MAX_APPOINTMENTS_PER_PAGE } from '@contracts/appointments/appointment-api.schema'
import {
  createAppointment,
  listAppointments,
  updateAppointment,
  type AppointmentCreateDto,
  type AppointmentListDto,
  type AppointmentUpdateDto,
} from '@/data/appointments/appointment.service'
import { normalizeSheetDate, todaySheetDate } from '@/shared/utils/sheet-date'
import { invalidate } from '@/shared/api/response-cache'

type AppointmentItem = AppointmentListDto | AppointmentCreateDto | AppointmentUpdateDto

export const useAppointmentStore = defineStore('appointments', () => {
  const selectedDate = ref(todaySheetDate())
  const items = ref<AppointmentListDto[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const dailyItems = computed(() =>
    items.value
      .filter((item) => item.appointmentDate === selectedDate.value && item.status !== 'PENDING')
      .sort((left, right) => left.timeSlot.localeCompare(right.timeSlot)),
  )
  const pendingItems = computed(() => {
    const today = todaySheetDate()
    return items.value
      .filter((item) => item.status === 'PENDING' && item.appointmentDate >= today)
      .sort((left, right) => {
        const dateComparison = left.appointmentDate.localeCompare(right.appointmentDate)
        return dateComparison || left.timeSlot.localeCompare(right.timeSlot)
      })
  })
  const pendingCount = computed(() => pendingItems.value.length)

  let loaded = false
  let loadPromise: Promise<void> | null = null

  async function load(force = false): Promise<void> {
    if (loaded && !force) return
    if (loadPromise) return loadPromise

    loadPromise = (async () => {
      loading.value = true
      error.value = null
      try {
        if (force) invalidate('/api/appointments')
        const result = await listAppointments({
          perPage: MAX_APPOINTMENTS_PER_PAGE,
          sortBy: 'appointmentDate',
          sortOrder: 'asc',
        })
        items.value = result.items.map(normalizeAppointmentItem)
        loaded = true
      } catch (reason) {
        error.value = messageFor(reason, 'Unable to load appointments')
      } finally {
        loading.value = false
        loadPromise = null
      }
    })()

    return loadPromise
  }

  async function loadInitial() {
    await load()
  }

  async function loadDate(date = selectedDate.value) {
    selectedDate.value = date
    await load()
  }

  async function loadPending(force = false) {
    await load(force)
  }

  async function refreshDate() {
    await load(true)
  }

  async function updateStatus(appointmentId: string, status: AppointmentListDto['status']) {
    const persisted = await updateAppointment(appointmentId, { status })
    applyPersisted(persisted)
    return persisted
  }

  async function rescheduleAppointment(
    appointmentId: string,
    data: Pick<AppointmentListDto, 'appointmentDate' | 'timeSlot' | 'vehicle'> & { notes: string | null },
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
    items.value = [
      ...items.value.filter((item) => item.appointmentId !== normalized.appointmentId),
      normalized,
    ]
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

function normalizeAppointmentItem<T extends { appointmentDate: string }>(item: T): T {
  const appointmentDate = normalizeSheetDate(item.appointmentDate)
  if (!appointmentDate || appointmentDate === item.appointmentDate) return item

  return { ...item, appointmentDate }
}

function messageFor(reason: unknown, fallback: string): string {
  return reason instanceof Error && reason.message ? reason.message : fallback
}
