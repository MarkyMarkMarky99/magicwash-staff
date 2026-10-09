import { computed, onActivated, onDeactivated, onBeforeUnmount, ref, watch } from 'vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRoute, useRouter } from 'vue-router'
import { listOrderImages, type OrderImageDto } from '@/data/order-images/order-image.service'
import { useJobTicketStore } from '@/data/job-tickets/job-ticket.store'
import { useCustomerStore } from '@/data/customers/customer.store'
import { filterTickets } from '../department-work'
import { currentActor } from '@/shared/config/actor'
import { feedback, primeFeedbackAudio } from '@/shared/utils/scan-feedback'
import { invalidate } from '@/shared/api/response-cache'
import { normalizeSheetTimestamp } from '@shared/utils/bangkok-datetime'

export function useLogisticsBags(orderId: () => string) {
  const route = useRoute()
  const router = useRouter()
  const customerStore = useCustomerStore()
  const images = ref<OrderImageDto[]>([])
  const ticketStore = useJobTicketStore()
  const tickets = computed(() => filterTickets(ticketStore.orderTickets(orderId(), 'Logistics'), 'ALL', 'Logistics'))
  let releaseOrder: (() => void) | undefined
  const scannedTicketIds = ref(new Set<string>())
  const pageLoading = ref(true)
  const pageError = ref<string | null>(null)
  const loading = computed(() => pageLoading.value || ticketStore.orderView(orderId(), 'Logistics').loading)
  const error = computed(() => pageError.value ?? ticketStore.orderView(orderId(), 'Logistics').error)
  const submitting = ref(false)
  const notice = ref<{ message: string; success: boolean } | null>(null)
  const scannerOpen = computed(() => route.name === 'logistics-order-bags' && route.params.orderId === orderId() && route.query.scan === '1')
  const customerId = computed(() => tickets.value.find(ticket => ticket.customerId)?.customerId ?? '')
  const customer = computed(() => customerStore.customers.find(row => row.customerId === customerId.value))
  const bags = computed(() => {
    const weights = new Map(images.value.map(image => [image.orderImageId, image.quantity]))
    const prefix = `LOG-${orderId()}-`
    return tickets.value.flatMap(ticket => {
      if (!ticket.id.startsWith(prefix) || !ticket.id.endsWith('-LOG-BAG')) return []
      const orderImageId = ticket.id.slice(prefix.length, -8)
      if (!orderImageId) return []
      return [{ ticket, orderImageId, weight: weights.get(orderImageId) ?? null,
        scanned: scannedTicketIds.value.has(ticket.id) || ticket.status === 'In Progress' || ticket.status === 'Completed' }]
    }).sort((a, b) => normalizeSheetTimestamp(a.ticket.createdAt).localeCompare(normalizeSheetTimestamp(b.ticket.createdAt)) || a.orderImageId.localeCompare(b.orderImageId))
  })
  const scannedCount = computed(() => bags.value.filter(bag => bag.scanned).length)
  const totalWeight = computed(() => Math.round(bags.value.reduce((total, bag) => total + (bag.weight ?? 0), 0) * 100) / 100)
  const complete = computed(() => bags.value.length > 0 && scannedCount.value === bags.value.length)
  let pushedScanner = false
  let replacingLeave = false
  let loadSequence = 0
  let noticeTimer: ReturnType<typeof setTimeout> | undefined

  async function load(): Promise<void> {
    releaseOrder?.()
    releaseOrder = ticketStore.retainOrder(orderId(), 'Logistics')
    const sequence = ++loadSequence
    const id = orderId()
    pageLoading.value = true
    pageError.value = null
    notice.value = null
    scannedTicketIds.value = new Set()
    try {
      const [photos] = await Promise.all([
        (async () => {
          const rows: OrderImageDto[] = []
          for (let page = 1; ; page += 1) {
            const result = await listOrderImages(id, page)
            rows.push(...result.items)
            if (result.items.length < 500) return rows
          }
        })(),
        ticketStore.loadOrder(id, 'Logistics'),
      ])
      if (sequence !== loadSequence) return
      images.value = photos
    } catch (reason) {
      if (sequence === loadSequence) pageError.value = reason instanceof Error ? reason.message : 'Unable to load bags'
    } finally {
      if (sequence === loadSequence) pageLoading.value = false
    }
  }

  function showNotice(message: string, success = false): void {
    notice.value = { message, success }
    if (noticeTimer) clearTimeout(noticeTimer)
    noticeTimer = setTimeout(() => { notice.value = null }, 5000)
    feedback(success ? 'success' : 'failure')
  }

  function openScanner(): void {
    scannedTicketIds.value = new Set()
    notice.value = null
    primeFeedbackAudio()
    void router.push({ query: { ...route.query, scan: '1' } }).then(() => { pushedScanner = scannerOpen.value })
  }

  function closeScanner(): void {
    if (submitting.value) return
    scannedTicketIds.value = new Set()
    if (pushedScanner) {
      pushedScanner = false
      router.back()
    } else {
      const query = { ...route.query }
      delete query.scan
      void router.replace({ query })
    }
  }

  function handleScan(value: string): void {
    if (!scannerOpen.value || submitting.value || loading.value || error.value) return
    const text = value.trim()
    const marker = text.lastIndexOf('/b/')
    const id = marker === -1 ? text : text.slice(marker + 3).trim()
    const bag = bags.value.find(row => row.orderImageId === id)
    if (!bag) return showNotice('Not a bag of this order')
    if (bag.scanned) return showNotice(`Bag ${id} already scanned`)
    if (bag.ticket.status !== 'Pending') return showNotice(`Bag ${id} cannot be scanned`)
    scannedTicketIds.value = new Set([...scannedTicketIds.value, bag.ticket.id])
    showNotice(`Bag ${id} scanned`, true)
    if (bags.value.every(row => row.ticket.status !== 'Pending' || row.scanned)) void confirmScans()
  }

  async function confirmScans(): Promise<void> {
    if (!scannerOpen.value || submitting.value || loading.value || error.value || !scannedTicketIds.value.size) return
    const id = orderId()
    const entries = [...scannedTicketIds.value].map(ticketId => ({ ticketId, orderId: id }))
    const actor = currentActor()
    submitting.value = true
    try {
      const result = await ticketStore.advanceTickets({ department: 'Logistics', fromStatus: 'Pending', scannedBy: actor, tickets: entries })
      if (id !== orderId()) return
      scannedTicketIds.value = new Set()
      if (result.kind === 'completed') {
        if (result.advanced.length !== entries.length) {
          await load()
          showNotice(`${result.advanced.length} bags started. Other bag statuses changed; check before scanning again`)
        } else showNotice(`${result.advanced.length} bags started`, true)
      } else {
        await load()
        showNotice(result.certainty === 'unknown' ? 'Scans could not be confirmed. Check the bags before scanning again' : 'Unable to save scans. Please try again')
      }
    } catch (reason) {
      if (id === orderId()) {
        await load()
        showNotice(reason instanceof Error ? reason.message : 'Unable to save scans. Check the bags before scanning again')
      }
    } finally {
      submitting.value = false
      invalidate('/api/job-tickets')
      if (id === orderId()) closeScanner()
    }
  }

  watch(orderId, () => { images.value = []; void load() })
  watch(scannerOpen, open => {
    if (!open) { pushedScanner = false; scannedTicketIds.value = new Set() }
  })
  onBeforeRouteUpdate(() => { if (submitting.value) return false })
  onActivated(() => { void load() })
  onDeactivated(() => { releaseOrder?.(); releaseOrder = undefined })
  onBeforeUnmount(() => { releaseOrder?.(); loadSequence += 1; if (noticeTimer) clearTimeout(noticeTimer) })
  onBeforeRouteLeave(to => {
    if (submitting.value) return false
    if (!scannerOpen.value || replacingLeave) return
    replacingLeave = true
    pushedScanner = false
    void router.replace(to).finally(() => { replacingLeave = false })
    return false
  })

  return { load, bags, tickets, customer, customerId, scannedTicketIds, scannedCount, totalWeight, complete, handleScan, confirmScans, openScanner, closeScanner, scannerOpen, notice, submitting, loading, error }
}
