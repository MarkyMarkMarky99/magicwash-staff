import { computed, onScopeDispose, ref, watch } from 'vue'
import { laundryTagIdSchema } from '@contracts/laundry-tag-prints/laundry-tag-print.schema'
import { getLaundryItem, updateLaundryItem, type LaundryItemDto } from '@/data/laundry-items/laundry-item.service'
import { createLaundryItemPhoto, listLaundryItemPhotos, type LaundryItemPhotoDto } from '@/data/laundry-item-photos/laundry-item-photo.service'
import { useJobTicketStore } from '@/data/job-tickets/job-ticket.store'
import type { JobTicketDto } from '@/data/job-tickets/job-ticket.service'
import { useItemsStore } from '@/data/items/items.store'
import { useCustomerStore } from '@/data/customers/customer.store'
import { useWashProgramsStore } from '@/data/wash-programs/wash-programs.store'
import { useStaffStore } from '@/data/staff/staff.store'
import type { GarmentPhotoSave } from './useLaundryItemPhotoCapture'

export type GarmentPrefetch = { photos: Promise<LaundryItemPhotoDto[]>, tickets: Promise<JobTicketDto[]> }

export function useLaundryItemDetail(tag: () => string, changed: (itemId: string) => void, initialGarment: () => LaundryItemDto | null | undefined = () => null, initialLoads: () => GarmentPrefetch | null | undefined = () => null) {
  const garment = ref<LaundryItemDto | null>(null)
  const photos = ref<LaundryItemPhotoDto[]>([])
  const tickets = ref<JobTicketDto[]>([])
  const photosLoaded = ref(false)
  const ticketsLoaded = ref(false)
  const photoError = ref<string | null>(null)
  const ticketError = ref<string | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const saving = ref(false)
  const saveError = ref<string | null>(null)
  const items = useItemsStore()
  const customers = useCustomerStore()
  const programs = useWashProgramsStore()
  const staff = useStaffStore()
  const jobTickets = useJobTicketStore()
  let requestId = 0
  let photoRefresh = 0

  async function load(): Promise<void> {
    const id = ++requestId
    const parsed = laundryTagIdSchema.safeParse(tag())
    garment.value = null
    photos.value = []
    tickets.value = []
    photosLoaded.value = false
    ticketsLoaded.value = false
    photoError.value = null
    ticketError.value = null
    photoRefresh += 1
    error.value = null
    saveError.value = null
    loading.value = false
    if (!parsed.success) { error.value = 'Invalid garment tag'; return }
    loading.value = true
    const refresh = photoRefresh
    const supplied = initialGarment()
    const prefetch = supplied?.id === parsed.data ? initialLoads() : null
    void (prefetch?.photos ?? listLaundryItemPhotos(parsed.data)).then(rows => {
      if (id === requestId && refresh === photoRefresh) { photos.value = rows; photosLoaded.value = true }
    }).catch(() => {
      if (id === requestId && refresh === photoRefresh) photoError.value = 'Unable to load garment photos'
    })
    void (prefetch?.tickets ?? jobTickets.loadGarment(parsed.data)).then(rows => {
      if (id === requestId) { tickets.value = rows; ticketsLoaded.value = true }
    }).catch(() => {
      if (id === requestId) ticketError.value = 'Unable to load garment orders'
    })
    if (items.items.length === 0) void items.load()
    void programs.load()
    if (!staff.loaded) void staff.load()
    try {
      const row = supplied?.id === parsed.data ? supplied : await getLaundryItem(parsed.data)
      if (id !== requestId) return
      if (!row || row.deletedAt !== null) throw new Error('Garment not found')
      garment.value = row
    } catch (reason) {
      if (id === requestId) error.value = reason instanceof Error ? reason.message : 'Unable to load garment details'
    } finally {
      if (id === requestId) loading.value = false
    }
  }

  async function changeType(itemId: string): Promise<boolean> {
    if (!garment.value || saving.value) return false
    saving.value = true
    saveError.value = null
    const currentTag = garment.value.id
    try {
      const updated = await updateLaundryItem(currentTag, { itemId })
      if (tag() !== currentTag) return false
      garment.value = updated
      changed(itemId)
      return true
    } catch (reason) {
      if (tag() === currentTag) saveError.value = reason instanceof Error ? reason.message : 'Unable to change type'
      return false
    } finally { saving.value = false }
  }

  async function addPhoto(input: GarmentPhotoSave): Promise<void> {
    if (!garment.value) throw new Error('Garment is not loaded')
    const currentTag = garment.value.id
    const id = requestId
    await createLaundryItemPhoto({ laundryItemId: currentTag, photoType: input.photoType, imageUrl: input.imageUrl, orderId: input.orderId, notes: null })
    if (id !== requestId) return
    const refresh = ++photoRefresh
    try {
      const fresh = await listLaundryItemPhotos(currentTag)
      if (id === requestId && refresh === photoRefresh) { photos.value = fresh; photosLoaded.value = true; photoError.value = null }
    } catch {
      if (id === requestId && refresh === photoRefresh) saveError.value = 'Saved, but the photo list could not refresh'
    }
  }

  const item = computed(() => items.items.find(item => item.id === garment.value?.itemId) ?? null)
  const customerName = computed(() => customers.customers.find(customer => customer.customerId === garment.value?.customerId)?.customerName ?? '–')
  const programName = computed(() => programs.items.find(program => program.id === garment.value?.washProgram)?.name ?? '–')
  watch(tag, () => { void load() }, { immediate: true })
  onScopeDispose(() => { requestId += 1 })
  return { garment, photos, tickets, photosLoaded, ticketsLoaded, photoError, ticketError, programs, loading, error, saving, saveError, items, staff, item, customerName, programName, load, changeType, addPhoto }
}
