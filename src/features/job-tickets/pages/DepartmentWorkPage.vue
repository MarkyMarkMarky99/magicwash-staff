<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRoute, useRouter } from 'vue-router'
import type { LocationQueryRaw, RouteLocationNormalized } from 'vue-router'
import GenericTabs from '@/shared/components/GenericTabs.vue'
import ListContainer from '@/shared/components/ListContainer.vue'
import QrScannerOverlay from '@/shared/components/QrScannerOverlay.vue'
import SquareImageCard from '@/shared/components/SquareImageCard.vue'
import StickerFab from '@/shared/components/StickerFab.vue'
import CloseButton from '@/shared/components/CloseButton.vue'
import AdvanceConfirmDialog from '../components/AdvanceConfirmDialog.vue'
import CompletionRing from '../components/CompletionRing.vue'
import ScanResultCard from '../components/ScanResultCard.vue'
import TicketStatusIcon, { type TicketTapState } from '../components/TicketStatusIcon.vue'
import ListPageLayout from '@/shared/layouts/ListPageLayout.vue'
import { useJobTicketStore } from '@/data/job-tickets/job-ticket.store'
import type { JobTicketDto } from '@/data/job-tickets/job-ticket.service'
import { useCustomerStore } from '@/data/customers/customer.store'
import { currentActor } from '@/shared/config/actor'
import { feedback, primeFeedbackAudio } from '@/shared/utils/scan-feedback'
import { formatSheetDate } from '@/shared/utils/sheet-date'
import { advanceSummary, countDepartmentStatuses, filterTickets, groupDepartmentOrders, readDepartment, readGrouper, readStatusFilter, resolveScanTag, restoreScanQueue, sortDepartmentTickets, statusFilters, statusForFilter, toggleTicketSelection } from '../department-work'
import type { AdvanceStatus, Grouper, OrderInfo, ScanQueueEntry, TicketStatus } from '../department-work'
import { presentStartOrderResult, type ScanDisplay } from '../scan-result'

const route = useRoute()
const router = useRouter()
const ticketStore = useJobTicketStore()
const customerStore = useCustomerStore()
const department = computed(() => readDepartment(route.params.department))
const activeFilter = computed(() => readStatusFilter(route.query.status))
const fromStatus = computed(() => statusForFilter(activeFilter.value))
const grouper = computed(() => readGrouper(route.query.group))
const scannerOpen = computed(() => department.value !== null && fromStatus.value !== null && route.query.scan === '1')
const expandedOrderId = ref<string | null>(null)
const scanResult = ref<ScanDisplay | null>(null)
const pageNotice = ref<ScanDisplay | null>(null)
const syncingOrderIds = ref(new Set<string>())
const tapStates = ref(new Map<string, TicketTapState>())
const tapTimers = new Map<string, ReturnType<typeof setTimeout>>()
const selectedTicketIds = ref(new Set<string>())
const scanQueue = ref<ScanQueueEntry[]>([])
const submitting = ref(false)
const confirmIntent = ref<'action' | 'scanner' | 'navigation' | null>(null)
let pendingDestination: RouteLocationNormalized | null = null
let bypassGuard = false
let restoredQueueKey = ''
let pushedScanner = false
let replacingLeave = false
let noticeTimer: ReturnType<typeof setTimeout> | undefined

const statusLabels: Record<TicketStatus, string> = {
  Pending: 'Pending',
  'In Progress': 'In Progress',
  Completed: 'Completed',
  Cancelled: 'Cancelled',
}
const filterLabels = { ALL: 'All', PENDING: 'Pending', 'IN PROGRESS': 'In Progress', COMPLETED: 'Completed' } as const
const counts = computed(() => countDepartmentStatuses(ticketStore.tickets))
const tabs = computed(() => statusFilters.map(key => ({ key, label: filterLabels[key], count: counts.value[key] })))

const orderInfo = computed(() => {
  const customers = new Map(customerStore.customers.map(customer => [customer.customerId, customer]))
  const info = new Map<string, OrderInfo>()
  for (const ticket of ticketStore.tickets) {
    if (info.has(ticket.orderId)) continue
    const customerId = ticket.customerId
    info.set(ticket.orderId, {
      dueDate: ticket.dueDate ?? null,
      customerId,
      customerName: (customerId && customers.get(customerId)?.customerName) || customerId || ticket.orderId,
      customerIndex: (customerId && customers.get(customerId)?.customerIndex) || null,
    })
  }
  return info
})
const visibleTickets = computed(() => sortDepartmentTickets(filterTickets(ticketStore.tickets, activeFilter.value), orderInfo.value))
const visibleOrders = computed(() => groupDepartmentOrders(visibleTickets.value, orderInfo.value))
const allOrders = computed(() => new Map(groupDepartmentOrders(ticketStore.tickets, orderInfo.value).map(order => [order.orderId, order])))

async function reload(): Promise<void> {
  const code = department.value?.code
  if (code) await ticketStore.loadDepartment(code)
}

watch(() => department.value?.code, code => {
  expandedOrderId.value = null
  scanResult.value = null
  dismissPageNotice()
  clearTapStates()
  if (code) void reload()
}, { immediate: true })

function changeFilter(value: string): void {
  if (!statusFilters.includes(value as typeof statusFilters[number])) return
  expandedOrderId.value = null
  const query: LocationQueryRaw = { ...route.query }
  if (value === 'ALL') delete query.status
  else query.status = value
  void router.replace({ query })
}

function changeGrouper(value: Grouper): void {
  expandedOrderId.value = null
  const query: LocationQueryRaw = { ...route.query }
  if (value === 'order') delete query.group
  else query.group = value
  void router.replace({ query })
}

function openScanner(): void {
  if (!department.value || !fromStatus.value || scannerOpen.value) return
  void primeFeedbackAudio()
  scanResult.value = null
  void router.push({ query: { ...route.query, scan: '1' } }).then(() => {
    pushedScanner = scannerOpen.value
  })
}

function closeScanner(): void {
  if (!scannerOpen.value) return
  if (scanQueue.value.length && !bypassGuard) {
    confirmIntent.value = 'scanner'
    return
  }
  scanResult.value = null
  if (pushedScanner) {
    pushedScanner = false
    router.back()
    return
  }
  const query: LocationQueryRaw = { ...route.query }
  delete query.scan
  void router.replace({ query })
}

function dismissPageNotice(): void {
  if (noticeTimer) clearTimeout(noticeTimer)
  noticeTimer = undefined
  pageNotice.value = null
}

function showPageNotice(result: ScanDisplay): void {
  dismissPageNotice()
  pageNotice.value = result
  if (result.tone !== 'loading') noticeTimer = setTimeout(dismissPageNotice, 5000)
}

function setTapState(ticketId: string, state: TicketTapState | null): void {
  const timer = tapTimers.get(ticketId)
  if (timer) clearTimeout(timer)
  tapTimers.delete(ticketId)
  const next = new Map(tapStates.value)
  if (state) next.set(ticketId, state)
  else next.delete(ticketId)
  tapStates.value = next
  if (state === 'failed') tapTimers.set(ticketId, setTimeout(() => setTapState(ticketId, null), 2000))
}

function clearTapStates(): void {
  for (const timer of tapTimers.values()) clearTimeout(timer)
  tapTimers.clear()
  tapStates.value = new Map()
}

function queueKey(code: string, status: AdvanceStatus): string {
  return `department-work:scan-queue:${code}:${status}`
}

function setScanQueue(queue: ScanQueueEntry[]): void {
  scanQueue.value = queue
  const code = department.value?.code
  const status = fromStatus.value
  if (!code || !status) return
  try {
    if (queue.length) localStorage.setItem(queueKey(code, status), JSON.stringify(queue))
    else localStorage.removeItem(queueKey(code, status))
  } catch { /* storage unavailable */ }
}

function clearPending(): void {
  selectedTicketIds.value = new Set()
  setScanQueue([])
}

watch([() => department.value?.code, fromStatus, () => ticketStore.loading], ([code, status, loading]) => {
  if (loading) {
    restoredQueueKey = ''
    return
  }
  if (!code || !status) return
  const key = queueKey(code, status)
  if (key === restoredQueueKey) return
  restoredQueueKey = key
  try { setScanQueue(restoreScanQueue(JSON.parse(localStorage.getItem(key) ?? 'null'), ticketStore.tickets, status, code)) }
  catch { setScanQueue([]) }
}, { immediate: true })

function toggleTicket(ticket: JobTicketDto): void {
  if (submitting.value || tapStates.value.get(ticket.id) === 'saving') return
  const next = toggleTicketSelection(selectedTicketIds.value, ticket, fromStatus.value)
  if (next.size + scanQueue.value.filter(entry => !next.has(entry.ticketId)).length > 200) {
    showPageNotice({ title: 'Selection full', message: 'Send up to 200 jobs at a time', tone: 'warning' })
    return
  }
  selectedTicketIds.value = next
}

function handleScan(value: string): void {
  const status = fromStatus.value
  if (!status || submitting.value) return
  const code = department.value?.code
  if (!code) return
  const result = resolveScanTag(value, ticketStore.tickets, status, scanQueue.value, code)
  if (result.entry && pendingTickets.value.length >= 200) {
    feedback('failure')
    scanResult.value = { title: value, message: 'Send up to 200 jobs at a time', tone: 'error' }
    return
  }
  if (result.entry) setScanQueue([...scanQueue.value, result.entry])
  feedback(result.entry ? 'success' : 'failure')
  scanResult.value = { title: value, message: result.message, tone: result.entry ? 'success' : 'error' }
}

const pendingTickets = computed(() => {
  const entries = new Map<string, { ticketId: string; orderId: string }>()
  for (const ticket of ticketStore.tickets) {
    if (selectedTicketIds.value.has(ticket.id)) entries.set(ticket.id, { ticketId: ticket.id, orderId: ticket.orderId })
  }
  for (const entry of scanQueue.value) entries.set(entry.ticketId, { ticketId: entry.ticketId, orderId: entry.orderId })
  return [...entries.values()]
})

function continueAfterConfirm(): void {
  const intent = confirmIntent.value
  const destination = pendingDestination
  confirmIntent.value = null
  pendingDestination = null
  if (intent === 'scanner') {
    bypassGuard = true
    closeScanner()
    setTimeout(() => { bypassGuard = false }, 0)
  } else if (intent === 'navigation' && destination) {
    bypassGuard = true
    void router.replace(destination).finally(() => { bypassGuard = false })
  }
}

function discardConfirmed(): void {
  clearPending()
  continueAfterConfirm()
}

async function sendConfirmed(): Promise<void> {
  const code = department.value?.code
  const status = fromStatus.value
  if (!code || !status || !pendingTickets.value.length || submitting.value) return
  const entries = pendingTickets.value.slice(0, 200)
  submitting.value = true
  for (const entry of entries) setTapState(entry.ticketId, 'saving')
  try {
    const response = await ticketStore.advanceTickets({ department: code, fromStatus: status, tickets: entries,
      scannedBy: currentActor(Array.isArray(route.query.by) ? route.query.by[0] : route.query.by) })
    for (const entry of entries) setTapState(entry.ticketId, null)
    if (response.kind === 'completed') {
      clearPending()
      for (const entry of [...response.blocked, ...response.skipped]) setTapState(entry.ticketId, 'failed')
      showPageNotice({ title: 'Jobs updated', message: advanceSummary(response, status), tone: response.blocked.length || response.skipped.length || response.scoreFailed > 0 ? 'warning' : 'success' })
      continueAfterConfirm()
    } else if (response.certainty === 'unknown') {
      clearPending()
      showPageNotice({ title: 'Could not save', message: 'Could not save. Check the jobs before sending again', tone: 'error' })
      confirmIntent.value = null
      pendingDestination = null
      await reload()
    } else {
      for (const entry of entries) setTapState(entry.ticketId, 'failed')
      showPageNotice({ title: 'Could not save', message: 'Could not save. Try again', tone: 'error' })
      confirmIntent.value = null
      pendingDestination = null
    }
  } catch {
    for (const entry of entries) setTapState(entry.ticketId, 'failed')
    showPageNotice({ title: 'Connection failed', message: 'Connection failed. Try again', tone: 'error' })
    confirmIntent.value = null
    pendingDestination = null
  } finally {
    submitting.value = false
  }
}

async function startOrder(orderId: string): Promise<void> {
  if (syncingOrderIds.value.has(orderId)) return
  const departmentCode = department.value?.code
  if (!departmentCode) return
  const tickets = allOrders.value.get(orderId)?.tickets ?? []
  if (!tickets.some(ticket => ticket.status === 'Pending')) return
  syncingOrderIds.value = new Set([...syncingOrderIds.value, orderId])
  dismissPageNotice()
  const pendingIds = tickets.filter(ticket => ticket.status === 'Pending').map(ticket => ticket.id)
  for (const ticketId of pendingIds) setTapState(ticketId, 'saving')
  try {
    const response = await ticketStore.startOrder({
      orderId,
      department: departmentCode,
      scannedBy: currentActor(Array.isArray(route.query.by) ? route.query.by[0] : route.query.by),
    })
    if (department.value?.code !== departmentCode) return
    for (const ticketId of pendingIds) setTapState(ticketId, null)
    const failedIds = response.kind === 'write_failed' ? pendingIds : response.blocked.map(ticket => ticket.ticketId)
    for (const ticketId of failedIds) setTapState(ticketId, 'failed')
    showPageNotice({ title: orderId, ...presentStartOrderResult(response) })
  } catch {
    if (department.value?.code !== departmentCode) return
    for (const ticketId of pendingIds) setTapState(ticketId, 'failed')
    showPageNotice({ title: orderId, message: 'Connection failed. Try again', tone: 'error' })
  } finally {
    for (const ticketId of pendingIds) {
      if (tapStates.value.get(ticketId) === 'saving') setTapState(ticketId, null)
    }
    const next = new Set(syncingOrderIds.value)
    next.delete(orderId)
    syncingOrderIds.value = next
  }
}

function statusShare(tickets: readonly JobTicketDto[], status: TicketStatus): number {
  return tickets.length === 0 ? 0 : Math.round(100 * statusCount(tickets, status) / tickets.length)
}

function statusCount(tickets: readonly JobTicketDto[], status: TicketStatus): number {
  return tickets.filter(ticket => ticket.status === status).length
}

watch(scannerOpen, open => {
  if (!open) {
    pushedScanner = false
    scanResult.value = null
  }
})

watch(fromStatus, () => {
  selectedTicketIds.value = new Set()
})

function guardPending(to: RouteLocationNormalized): boolean | void {
  if (bypassGuard || submitting.value) return submitting.value ? false : undefined
  if (!selectedTicketIds.value.size && !scanQueue.value.length) return
  const statusChanged = readStatusFilter(to.query.status) !== activeFilter.value
  const departmentChanged = readDepartment(to.params.department)?.code !== department.value?.code
  const scannerClosing = scannerOpen.value && to.query.scan !== '1'
  if (!statusChanged && !departmentChanged && !scannerClosing && to.name === route.name) return
  confirmIntent.value = scannerClosing && !statusChanged && !departmentChanged && to.name === route.name ? 'scanner' : 'navigation'
  pendingDestination = confirmIntent.value === 'navigation' ? to : null
  return false
}

onBeforeRouteUpdate(to => guardPending(to))

onBeforeUnmount(() => {
  dismissPageNotice()
  clearTapStates()
})

onBeforeRouteLeave(to => {
  const pending = guardPending(to)
  if (pending === false) return false
  if (!scannerOpen.value || replacingLeave) return
  replacingLeave = true
  pushedScanner = false
  void router.replace(to).finally(() => { replacingLeave = false })
  return false
})
</script>

<template>
  <ListPageLayout>
    <template v-if="department" #filters>
      <GenericTabs :tabs="tabs" :active-key="activeFilter" @select="changeFilter" />
    </template>

    <div v-if="department && ticketStore.truncated" role="alert" class="flex-none border-b border-warning bg-warning-container px-4 py-2 font-body text-sm text-on-warning-container">
      List incomplete: showing up to 2,000 jobs
    </div>

    <ListContainer
      v-if="department"
      :title="department.label" icon="assignment"
      :count="grouper === 'order' ? visibleOrders.length : visibleTickets.length"
      :count-label="grouper === 'order' ? 'orders' : 'items'"
      :loading="ticketStore.loading" :error="ticketStore.error"
      :empty="!ticketStore.loading && !ticketStore.error && visibleTickets.length === 0"
      empty-text="No jobs with this status" :skeleton-rows="5"
    >
      <template #actions>
        <div class="flex rounded-full bg-surface-container p-0.5 font-label text-[10px]">
          <button type="button" class="flex items-center gap-1 rounded-full px-2 py-1 focus-visible:outline-2 focus-visible:outline-lime" :class="grouper === 'item' ? 'bg-primary text-on-primary' : 'text-on-surface-variant'" :aria-pressed="grouper === 'item'" aria-label="By item" @click="changeGrouper('item')"><span class="material-symbols-outlined text-[16px]" aria-hidden="true">grid_view</span></button>
          <button type="button" class="flex items-center gap-1 rounded-full px-2 py-1 focus-visible:outline-2 focus-visible:outline-lime" :class="grouper === 'order' ? 'bg-primary text-on-primary' : 'text-on-surface-variant'" :aria-pressed="grouper === 'order'" aria-label="By order" @click="changeGrouper('order')"><span class="material-symbols-outlined text-[16px]" aria-hidden="true">view_agenda</span></button>
        </div>
      </template>
      <template #error>
        <div class="px-4 py-6 text-center">
          <p role="alert" class="text-sm text-error">{{ ticketStore.error }}</p>
          <button type="button" class="mt-3 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-on-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime" @click="reload">Try again</button>
        </div>
      </template>

      <div v-if="grouper === 'item'" class="grid grid-cols-2 gap-2 p-4 sm:grid-cols-3">
        <button v-for="ticket in visibleTickets" :key="ticket.id" type="button" class="relative min-w-0 rounded-xl focus-visible:outline-2 focus-visible:outline-lime" :class="selectedTicketIds.has(ticket.id) ? 'ring-4 ring-lime' : ''" :aria-pressed="selectedTicketIds.has(ticket.id)" :aria-label="`Select tag ${ticket.laundryItemId ?? 'missing'}; current status ${statusLabels[ticket.status]}`" @click="toggleTicket(ticket)">
          <SquareImageCard :image-url="ticket.photoEvidenceUrl">
            <template #badge><TicketStatusIcon :status="ticket.status" :state="tapStates.get(ticket.id)" /></template>
          </SquareImageCard>
          <span v-if="selectedTicketIds.has(ticket.id)" class="material-symbols-outlined absolute bottom-2 right-2 rounded-full bg-lime p-1 text-primary" aria-hidden="true">check</span>
        </button>
      </div>

      <div v-for="order in grouper === 'order' ? visibleOrders : []" :key="order.orderId" class="bg-surface px-4 py-2">
        <div class="relative rounded-2xl border border-outline-variant/30 bg-surface-container-low">
          <button
            type="button"
            class="w-full rounded-2xl p-4 text-left focus-visible:outline-2 focus-visible:outline-lime"
            :aria-expanded="expandedOrderId === order.orderId"
            @click="expandedOrderId = expandedOrderId === order.orderId ? null : order.orderId"
          >
            <span class="flex items-start justify-between gap-2 pr-11">
              <span class="min-w-0">
                <strong class="block truncate font-headline text-sm text-primary">{{ order.customerName }}</strong>
                <span class="block truncate font-label text-xs text-on-surface-variant">{{ order.orderId }} · Due {{ formatSheetDate(order.dueDate) }}</span>
              </span>
            </span>
            <span class="mt-4 grid grid-cols-[164px_minmax(0,1fr)] items-center gap-4">
              <CompletionRing :percentage="allOrders.get(order.orderId)?.percentage ?? 0" :completed="statusCount(allOrders.get(order.orderId)?.tickets ?? [], 'Completed')" :total="allOrders.get(order.orderId)?.tickets.length ?? 0" :label="order.customerIndex ?? '-'" />
              <span class="flex min-w-0 flex-col gap-1.5">
                <span class="relative flex h-[50px] items-center gap-3 overflow-hidden rounded-2xl pl-2 pr-3 bg-warning-container"><span class="absolute inset-y-0 left-0 bg-warning/15" :style="{ width: `${statusShare(allOrders.get(order.orderId)?.tickets ?? [], 'Pending')}%` }" /><span class="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-warning/25 text-on-surface"><span class="material-symbols-outlined text-[18px]" aria-hidden="true">schedule</span></span><span class="relative flex min-w-0 flex-col justify-center"><span class="truncate font-label text-[12px] font-medium leading-4 text-on-surface/70">Pending</span><strong class="font-headline text-[22px] font-semibold leading-6 text-on-surface">{{ statusCount(allOrders.get(order.orderId)?.tickets ?? [], 'Pending') }}</strong></span></span>
                <span class="relative flex h-[50px] items-center gap-3 overflow-hidden rounded-2xl pl-2 pr-3 bg-secondary-container/40"><span class="absolute inset-y-0 left-0 bg-secondary/10" :style="{ width: `${statusShare(allOrders.get(order.orderId)?.tickets ?? [], 'In Progress')}%` }" /><span class="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-secondary/25 text-on-surface"><span class="material-symbols-outlined text-[18px]" aria-hidden="true">autorenew</span></span><span class="relative flex min-w-0 flex-col justify-center"><span class="truncate font-label text-[12px] font-medium leading-4 text-on-surface/70">In Progress</span><strong class="font-headline text-[22px] font-semibold leading-6 text-on-surface">{{ statusCount(allOrders.get(order.orderId)?.tickets ?? [], 'In Progress') }}</strong></span></span>
                <span class="relative flex h-[50px] items-center gap-3 overflow-hidden rounded-2xl pl-2 pr-3 bg-lime/20"><span class="absolute inset-y-0 left-0 bg-lime/25" :style="{ width: `${statusShare(allOrders.get(order.orderId)?.tickets ?? [], 'Completed')}%` }" /><span class="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-lime/60 text-on-surface"><span class="material-symbols-outlined text-[18px]" aria-hidden="true">check_circle</span></span><span class="relative flex min-w-0 flex-col justify-center"><span class="truncate font-label text-[12px] font-medium leading-4 text-on-surface/70">Completed</span><strong class="font-headline text-[22px] font-semibold leading-6 text-on-surface">{{ statusCount(allOrders.get(order.orderId)?.tickets ?? [], 'Completed') }}</strong></span></span>
              </span>
            </span>
          </button>
          <button type="button" class="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-xl bg-secondary/25 text-on-surface focus-visible:outline-2 focus-visible:outline-lime disabled:opacity-40" :aria-label="syncingOrderIds.has(order.orderId) ? 'Syncing' : 'Start all pending'" :disabled="syncingOrderIds.has(order.orderId) || statusCount(allOrders.get(order.orderId)?.tickets ?? [], 'Pending') === 0" @click="startOrder(order.orderId)"><span v-if="syncingOrderIds.has(order.orderId)" class="material-symbols-outlined animate-spin text-[22px]" aria-hidden="true">sync</span><svg v-else viewBox="0 0 24 24" class="h-6 w-6" aria-hidden="true"><path d="M8.5 6v12l9.5-6z" fill="currentColor" stroke="currentColor" stroke-width="3.5" stroke-linejoin="round" /></svg></button>
          <div v-if="expandedOrderId === order.orderId" class="grid grid-cols-2 gap-2 px-4 pb-4 sm:grid-cols-3">
            <button v-for="ticket in order.tickets" :key="ticket.id" type="button" class="relative min-w-0 rounded-xl focus-visible:outline-2 focus-visible:outline-lime" :class="selectedTicketIds.has(ticket.id) ? 'ring-4 ring-lime' : ''" :aria-pressed="selectedTicketIds.has(ticket.id)" :aria-label="`Select tag ${ticket.laundryItemId ?? 'missing'}; current status ${statusLabels[ticket.status]}`" @click="toggleTicket(ticket)">
              <SquareImageCard :image-url="ticket.photoEvidenceUrl">
                <template #badge><TicketStatusIcon :status="ticket.status" :state="tapStates.get(ticket.id)" /></template>
              </SquareImageCard>
              <span v-if="selectedTicketIds.has(ticket.id)" class="material-symbols-outlined absolute bottom-2 right-2 rounded-full bg-lime p-1 text-primary" aria-hidden="true">check</span>
            </button>
          </div>
        </div>
      </div>
    </ListContainer>
    <ListContainer v-else title="Department not found" icon="error" count-label="orders" empty empty-text="Unknown department" />

    <CloseButton v-if="selectedTicketIds.size && fromStatus" class="absolute bottom-[max(2.25rem,env(safe-area-inset-bottom)+1rem)] right-28 z-10 bg-surface" label="Clear selection" @click="selectedTicketIds = new Set()" />
    <StickerFab v-if="department && fromStatus" class="absolute bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-5 z-10" :label="selectedTicketIds.size ? `${fromStatus === 'Pending' ? 'Start' : 'Complete'} ${selectedTicketIds.size}` : 'Scan'" :aria-label="selectedTicketIds.size ? 'Review selected jobs' : 'Scan tag'" :disabled="ticketStore.loading || !!ticketStore.error || submitting" :saving="submitting" @click="selectedTicketIds.size ? confirmIntent = 'action' : openScanner()">
      <span class="material-symbols-outlined" style="font-size: 36px; font-variation-settings: 'wght' 600" aria-hidden="true">{{ selectedTicketIds.size ? 'check' : 'qr_code_scanner' }}</span>
    </StickerFab>

    <div v-if="pageNotice && !scannerOpen" class="pointer-events-none absolute bottom-[max(1.25rem,env(safe-area-inset-bottom))] left-4 right-20 z-20">
      <div class="pointer-events-auto"><ScanResultCard :result="pageNotice" dismissible @dismiss="dismissPageNotice" /></div>
    </div>

    <QrScannerOverlay :open="scannerOpen" :title="department?.label ?? ''" @close="closeScanner" @scan="handleScan">
      <template #result>
        <p class="mb-2 font-label text-sm font-bold">{{ scanQueue.length }} queued</p>
        <ScanResultCard v-if="scanResult" :result="scanResult" />
      </template>
    </QrScannerOverlay>
    <AdvanceConfirmDialog v-if="confirmIntent && !submitting"title="Send job updates?" :message="`${pendingTickets.length} jobs are ready to ${fromStatus === 'Pending' ? 'start' : 'complete'}.`" :count="pendingTickets.length" :send-label="`Send ${pendingTickets.length}`" :show-cancel="true" @send="sendConfirmed" @discard="discardConfirmed" @cancel="confirmIntent = null; pendingDestination = null" />
  </ListPageLayout>
</template>
