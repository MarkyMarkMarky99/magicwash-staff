import { computed, onScopeDispose, ref, watch } from 'vue'
import { laundryTagIdSchema } from '@contracts/laundry-tag-prints/laundry-tag-print.schema'
import { getLaundryItem, updateLaundryItem, type LaundryItemDto } from '@/data/laundry-items/laundry-item.service'
import { listGarmentOrders, type OrderGarmentDto } from '@/data/order-garments/order-garment.service'
import { createLaundryItemPhoto, listLaundryItemPhotos, type LaundryItemPhotoDto } from '@/data/laundry-item-photos/laundry-item-photo.service'
import { listOrdersByCustomer, type OrderListDto } from '@/data/orders/order.service'
import { useJobTicketStore } from '@/data/job-tickets/job-ticket.store'
import type { JobTicketDto } from '@/data/job-tickets/job-ticket.service'
import { useItemsStore } from '@/data/items/items.store'
import { useCustomerStore } from '@/data/customers/customer.store'
import { useWashProgramsStore } from '@/data/wash-programs/wash-programs.store'
import { useStaffStore } from '@/data/staff/staff.store'
import type { GarmentPhotoSave } from './useLaundryItemPhotoCapture'

export function useLaundryItemDetail(tag: () => string, changed: (itemId: string) => void) {
  const garment = ref<LaundryItemDto | null>(null)
  const links = ref<OrderGarmentDto[]>([])
  const photos = ref<LaundryItemPhotoDto[]>([])
  const orders = ref<OrderListDto[]>([])
  const tickets = ref<JobTicketDto[]>([])
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
    error.value = null
    saveError.value = null
    loading.value = false
    if (!parsed.success) { error.value = 'Invalid garment tag'; return }
    loading.value = true
    try {
      const garmentRequest = getLaundryItem(parsed.data)
      const results = await Promise.all([
        garmentRequest,
        listGarmentOrders(parsed.data),
        listLaundryItemPhotos(parsed.data),
        jobTickets.loadGarment(parsed.data),
        garmentRequest.then(row => row && !row.deletedAt ? listOrdersByCustomer(row.customerId, fresh => {
          if (id === requestId) orders.value = fresh
        }) : []),
        items.load(), customers.loadCustomers(), programs.load(), staff.loaded ? Promise.resolve() : staff.load(),
      ])
      if (id !== requestId) return
      if (items.error || customers.error || programs.error || staff.error) throw new Error('Unable to load garment details')
      const [row, orderLinks, itemPhotos, jobRows, customerOrders] = results
      if (!row || row.deletedAt !== null) throw new Error('Garment not found')
      garment.value = row
      links.value = orderLinks
      photos.value = itemPhotos
      tickets.value = jobRows
      orders.value = customerOrders
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
    await createLaundryItemPhoto({ laundryItemId: currentTag, photoType: input.photoType, imageUrl: input.imageUrl, orderId: input.orderId, notes: null })
    const refresh = ++photoRefresh
    try {
      const fresh = await listLaundryItemPhotos(currentTag)
      if (tag() === currentTag && refresh === photoRefresh) photos.value = fresh
    } catch {
      saveError.value = 'Saved, but the photo list could not refresh'
    }
  }

  const item = computed(() => items.items.find(item => item.id === garment.value?.itemId) ?? null)
  const customerName = computed(() => customers.customers.find(customer => customer.customerId === garment.value?.customerId)?.customerName ?? '–')
  const programName = computed(() => programs.items.find(program => program.id === garment.value?.washProgram)?.name ?? '–')
  watch(tag, () => { void load() }, { immediate: true })
  onScopeDispose(() => { requestId += 1 })
  return { garment, links, photos, orders, tickets, loading, error, saving, saveError, items, staff, item, customerName, programName, load, changeType, addPhoto }
}
