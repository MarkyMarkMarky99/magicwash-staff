import { computed, onBeforeUnmount, ref } from 'vue'
import { generateShortId } from '@shared/utils/id'
import { loadPackagingOrder } from '../packaging-bag-source'
import {
  bagNumber, canConfirm, confirmBags, confirmedTimestamp, garmentsInNewBags, restoreBags, scanGarment, toggleGarment, unassignedCount,
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
    if (bags.length) localStorage.setItem(STORAGE_PREFIX + orderId, JSON.stringify(bags.map(({ id, garmentTagIds }) => ({ id, garmentTagIds }))))
    else localStorage.removeItem(STORAGE_PREFIX + orderId)
  } catch {
    return
  }
}

export function usePackagingBags(orderId: () => string) {
  const order = ref<PackagingOrder | null>(null)
  const bags = ref<NewBag[]>([])
  const loading = ref(true)
  const error = ref<string | null>(null)
  const photoUrls = new Set<string>()
  let loadSequence = 0

  const unassigned = computed(() => order.value ? unassignedCount(order.value, bags.value) : 0)
  const pending = computed(() => garmentsInNewBags(bags.value))
  const emptyBags = computed(() => bags.value.filter(bag => !bag.garmentTagIds.length))
  const bagsWithoutPhoto = computed(() => bags.value.filter(bag => !bag.photoUrl))
  const confirmable = computed(() => canConfirm(bags.value))

  function releasePhoto(url: string | null): void {
    if (!url) return
    URL.revokeObjectURL(url)
    photoUrls.delete(url)
  }

  function releaseAllPhotos(): void {
    photoUrls.forEach(url => URL.revokeObjectURL(url))
    photoUrls.clear()
  }

  function commit(next: NewBag[]): void {
    bags.value = next
    if (order.value) writeStoredBags(order.value.orderId, next)
  }

  async function load(): Promise<void> {
    const sequence = ++loadSequence
    const id = orderId()
    loading.value = true
    error.value = null
    try {
      const loaded = await loadPackagingOrder(id)
      if (sequence !== loadSequence) return
      releaseAllPhotos()
      order.value = loaded
      bags.value = restoreBags(loaded, readStoredBags(id))
    } catch (reason) {
      if (sequence === loadSequence) error.value = reason instanceof Error ? reason.message : 'Unable to load order'
    } finally {
      if (sequence === loadSequence) loading.value = false
    }
  }

  function addBag(): string {
    const id = generateShortId()
    commit([...bags.value, { id, garmentTagIds: [], photoUrl: null }])
    return id
  }

  function deleteBag(bagId: string): void {
    releasePhoto(bags.value.find(bag => bag.id === bagId)?.photoUrl ?? null)
    commit(bags.value.filter(bag => bag.id !== bagId))
  }

  function toggle(bagId: string, tagId: string): void {
    if (order.value) commit(toggleGarment(order.value, bags.value, bagId, tagId))
  }

  function scan(bagId: string, value: string): BagScanOutcome | null {
    if (!order.value) return null
    const outcome = scanGarment(order.value, bags.value, bagId, value)
    commit(outcome.bags)
    return outcome
  }

  function setPhoto(bagId: string, file: File): void {
    const bag = bags.value.find(row => row.id === bagId)
    if (!bag) return
    const url = URL.createObjectURL(file)
    photoUrls.add(url)
    releasePhoto(bag.photoUrl)
    commit(bags.value.map(row => row.id === bagId ? { ...row, photoUrl: url } : row))
  }

  function confirm(): number {
    if (!order.value || !confirmable.value) return 0
    const count = bags.value.length
    order.value = confirmBags(order.value, bags.value, confirmedTimestamp())
    commit([])
    return count
  }

  function numberOf(bagId: string): number {
    return order.value ? bagNumber(order.value, bags.value, bagId) : 0
  }

  onBeforeUnmount(() => {
    loadSequence += 1
    releaseAllPhotos()
  })

  return { order, bags, loading, error, unassigned, pending, emptyBags, bagsWithoutPhoto, confirmable, load, addBag, deleteBag, toggle, scan, setPhoto, confirm, numberOf }
}
