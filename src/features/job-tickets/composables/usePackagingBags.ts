import { computed, onActivated, onDeactivated, onBeforeUnmount, ref, watch } from 'vue'
import { useJobTicketStore } from '@/data/job-tickets/job-ticket.store'
import { generateShortId } from '@shared/utils/id'
import { uploadToStorage } from '@/shared/api/firebase-storage'
import { confirmPackagingBags } from '@/data/packaging-bags/packaging-bag.service'
import { currentActor } from '@/shared/config/actor'
import { loadPackagingOrder, loadPackagingOrderStatus } from '../packaging-bag-source'
import {
  bagNumber, canConfirm, garmentsInNewBags, restoreBags, scanGarment, toggleGarment, unassignedCount,
  type BagScanOutcome, type NewBag, type PackagingOrder,
} from '../packaging-bags'

const STORAGE_PREFIX = 'magicwash.packaging-bags.'

function readStoredBags(orderId: string): unknown {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + orderId)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function writeStoredBags(orderId: string, bags: readonly NewBag[]): void {
  try {
    if (bags.length) localStorage.setItem(STORAGE_PREFIX + orderId, JSON.stringify(bags))
    else localStorage.removeItem(STORAGE_PREFIX + orderId)
  } catch {
    return
  }
}

export function usePackagingBags(orderId: () => string) {
  const ticketStore = useJobTicketStore()
  let releaseOrder: (() => void) | undefined
  let rebuild: (() => PackagingOrder) | undefined
  const ticketsReady = ref(false)
  const ticketsLoading = computed(() => !ticketsReady.value || ticketStore.orderView(orderId()).loading || !!ticketStore.orderView(orderId()).error)
  const order = ref<PackagingOrder | null>(null)
  const bags = ref<NewBag[]>([])
  const pageLoading = ref(true)
  const pageError = ref<string | null>(null)
  const loading = computed(() => pageLoading.value || ticketStore.orderView(orderId()).loading)
  const error = computed(() => pageError.value ?? ticketStore.orderView(orderId()).error)
  const notice = ref<string | null>(null)
  const submitting = ref(false)
  const uploading = ref(new Set<string>())
  let loadSequence = 0

  const unassigned = computed(() => order.value ? unassignedCount(order.value, bags.value) : 0)
  const pending = computed(() => garmentsInNewBags(bags.value))
  const emptyBags = computed(() => bags.value.filter(bag => !bag.garmentTagIds.length))
  const bagsWithoutPhoto = computed(() => bags.value.filter(bag => !bag.photoUrl))
  const confirmable = computed(() => !ticketsLoading.value && !submitting.value && !uploading.value.size && bags.value.length <= 20 && canConfirm(bags.value))

  function commit(next: NewBag[]): void {
    bags.value = next
    if (order.value) writeStoredBags(order.value.orderId, next)
  }

  function applyOrder(loaded: PackagingOrder, restored: NewBag[]): void {
    const retryIds = new Set(restored.map(bag => bag.id))
    order.value = { ...loaded,
      confirmedBags: loaded.confirmedBags.filter(bag => !retryIds.has(bag.id)),
      garments: loaded.garments.map(garment => ({ ...garment,
        confirmedBagId: garment.confirmedBagId && retryIds.has(garment.confirmedBagId) ? null : garment.confirmedBagId })),
    }
    bags.value = restored
  }

  async function load(): Promise<void> {
    releaseOrder?.()
    releaseOrder = ticketStore.retainOrder(orderId())
    rebuild = undefined
    ticketsReady.value = false
    const sequence = ++loadSequence
    const id = orderId()
    pageLoading.value = true
    pageError.value = null
    try {
      const loaded = await loadPackagingOrder(id, (preview, builder) => {
        if (sequence !== loadSequence) return
        rebuild = builder
        applyOrder(preview, restoreBags(preview, readStoredBags(id)))
      })
      if (sequence !== loadSequence) return
      ticketsReady.value = true
      const restored = restoreBags(loaded, readStoredBags(id))
      applyOrder(loaded, restored)
      void loadPackagingOrderStatus(id).then(label => {
        if (sequence === loadSequence && order.value) order.value = { ...order.value, statusLabel: label }
      }, () => {})
    } catch (reason) {
      if (sequence === loadSequence) pageError.value = reason instanceof Error ? reason.message : 'Unable to load order'
    } finally {
      if (sequence === loadSequence) pageLoading.value = false
    }
  }

  function addBag(): string {
    if (submitting.value || bags.value.length >= 20) {
      notice.value = 'Confirm the current bags before adding more (maximum 20).'
      return ''
    }
    const id = generateShortId()
    commit([...bags.value, { id, garmentTagIds: [], photoUrl: null }])
    return id
  }

  function deleteBag(bagId: string): void {
    if (!submitting.value) commit(bags.value.filter(bag => bag.id !== bagId))
  }

  function toggle(bagId: string, tagId: string): void {
    if (order.value && !ticketsLoading.value && !submitting.value) commit(toggleGarment(order.value, bags.value, bagId, tagId))
  }

  function scan(bagId: string, value: string): BagScanOutcome | null {
    if (!order.value || ticketsLoading.value || submitting.value) return null
    const outcome = scanGarment(order.value, bags.value, bagId, value)
    commit(outcome.bags)
    return outcome
  }

  async function setPhoto(bagId: string, file: File): Promise<void> {
    if (!order.value || submitting.value || uploading.value.has(bagId) || !bags.value.some(row => row.id === bagId)) return
    const id = order.value.orderId
    const sequence = loadSequence
    uploading.value = new Set([...uploading.value, bagId])
    notice.value = null
    try {
      const url = await uploadToStorage(file, `order-images/${id}`)
      if (sequence !== loadSequence) return
      commit(bags.value.map(row => row.id === bagId ? { ...row, photoUrl: url } : row))
    } catch (reason) {
      if (sequence === loadSequence) notice.value = reason instanceof Error ? reason.message : 'Bag photo upload failed. Take the photo again.'
    } finally {
      uploading.value = new Set([...uploading.value].filter(id => id !== bagId))
    }
  }

  async function confirm(): Promise<string | null> {
    if (!order.value || !confirmable.value) return null
    submitting.value = true
    notice.value = null
    const id = order.value.orderId
    try {
      const result = await confirmPackagingBags({ orderId: id, createdBy: currentActor(),
        bags: bags.value.map(bag => ({ orderImageId: bag.id, imagePath: bag.photoUrl!, laundryItemIds: [...bag.garmentTagIds] })),
      })
      const printed = result.bags.filter(bag => bag.printed).length
      const failed = result.bags.length - printed
      writeStoredBags(id, [])
      bags.value = []
      await load()
      return `${printed} bag ${printed === 1 ? 'tag printed' : 'tags printed'}.${failed ? ` ${failed} did not print.` : ' Stick each tag on its bag.'}`
    } catch (reason) {
      notice.value = reason instanceof Error ? reason.message : 'Unable to confirm bags. Press Confirm again.'
      return null
    } finally {
      submitting.value = false
    }
  }

  function numberOf(bagId: string): number {
    return order.value ? bagNumber(order.value, bags.value, bagId) : 0
  }

  watch(() => ticketStore.orderTickets(orderId()), () => {
    if (!rebuild || !order.value) return
    applyOrder({ ...rebuild(), statusLabel: order.value.statusLabel }, bags.value)
  }, { deep: true })

  onActivated(() => { if (!releaseOrder) releaseOrder = ticketStore.retainOrder(orderId()) })
  onDeactivated(() => { releaseOrder?.(); releaseOrder = undefined })
  onBeforeUnmount(() => { releaseOrder?.(); loadSequence += 1 })

  return { order, bags, ticketsLoading, loading, error, notice, submitting, uploading, unassigned, pending, emptyBags, bagsWithoutPhoto, confirmable, load, addBag, deleteBag, toggle, scan, setPhoto, confirm, numberOf }
}
