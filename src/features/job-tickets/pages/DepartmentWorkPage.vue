<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import type { LocationQueryRaw } from 'vue-router'
import GenericTabs from '@/shared/components/GenericTabs.vue'
import ListContainer from '@/shared/components/ListContainer.vue'
import QrScannerOverlay from '@/shared/components/QrScannerOverlay.vue'
import SquareImageCard from '@/shared/components/SquareImageCard.vue'
import CompletionRing from '../components/CompletionRing.vue'
import ScanResultCard from '../components/ScanResultCard.vue'
import TicketStatusIcon, { type TicketTapState } from '../components/TicketStatusIcon.vue'
import ListPageLayout from '@/shared/layouts/ListPageLayout.vue'
import { useJobTicketStore } from '@/data/job-tickets/job-ticket.store'
import type { JobTicketDto } from '@/data/job-tickets/job-ticket.service'
import { useWorkOrderStore } from '@/data/work-orders/work-order.store'
import { getWorkOrder, type WorkOrderDetailDto } from '@/data/work-orders/work-order.service'
import { useCustomerStore } from '@/data/customers/customer.store'
import { currentActor } from '@/shared/config/actor'
import { feedback, primeFeedbackAudio } from '@/shared/utils/scan-feedback'
import { formatSheetDate } from '@/shared/utils/sheet-date'
import { countDepartmentStatuses, filterTickets, groupDepartmentOrders, pendingOrderTags, readDepartment, readGrouper, readStatusFilter, sortDepartmentTickets, statusFilters } from '../department-work'
import type { Grouper, OrderInfo, TicketStatus } from '../department-work'
import { createTagScanGuard, feedbackOutcomeForScanResult, presentScanResult, type ScanDisplay } from '../scan-result'

const route = useRoute()
const router = useRouter()
const ticketStore = useJobTicketStore()
const workOrderStore = useWorkOrderStore()
const customerStore = useCustomerStore()
const department = computed(() => readDepartment(route.params.department))
const activeFilter = computed(() => readStatusFilter(route.query.status))
const grouper = computed(() => readGrouper(route.query.group))
const scannerOpen = computed(() => department.value !== null && route.query.scan === '1')
const expandedOrderId = ref<string | null>(null)
const scanResult = ref<ScanDisplay | null>(null)
const pageNotice = ref<ScanDisplay | null>(null)
const startingOrderId = ref<string | null>(null)
const tapStates = ref(new Map<string, TicketTapState>())
const tapTimers = new Map<string, ReturnType<typeof setTimeout>>()
const orderDetails = shallowRef(new Map<string, WorkOrderDetailDto>())
const metadataLoading = ref(false)
const metadataError = ref<string | null>(null)
const detailPromises = new Map<string, Promise<void>>()
const runTagScan = createTagScanGuard()
let pageRequestId = 0
let latestScanVersion = 0
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
const listLoading = computed(() => ticketStore.loading || metadataLoading.value)
const listError = computed(() => ticketStore.error || metadataError.value)

const orderInfo = computed(() => {
  const listed = new Map(workOrderStore.orders.map(order => [order.orderId, order]))
  const customers = new Map(customerStore.customers.map(customer => [customer.customerId, customer]))
  const info = new Map<string, OrderInfo>()
  for (const ticket of ticketStore.tickets) {
    if (info.has(ticket.orderId)) continue
    const order = listed.get(ticket.orderId) ?? orderDetails.value.get(ticket.orderId)
    const customerId = order?.customerId ?? ticket.customerId
    info.set(ticket.orderId, {
      dueDate: order?.dueDate ?? ticket.dueDate ?? null,
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

async function loadMissingOrderDetails(requestId: number): Promise<void> {
  const listed = new Set(workOrderStore.orders.map(order => order.orderId))
  const missingIds = [...new Set(ticketStore.tickets.map(ticket => ticket.orderId))]
    .filter(orderId => !listed.has(orderId) && !orderDetails.value.has(orderId))
  if (missingIds.length === 0) return
  metadataLoading.value = true
  const results = await Promise.allSettled(missingIds.map(orderId => {
    let promise = detailPromises.get(orderId)
    if (!promise) {
      promise = getWorkOrder(orderId).then(order => {
        orderDetails.value = new Map(orderDetails.value).set(orderId, order)
      }).finally(() => { detailPromises.delete(orderId) })
      detailPromises.set(orderId, promise)
    }
    return promise
  }))
  if (requestId !== pageRequestId) return
  metadataError.value = results.some(result => result.status === 'rejected') ? 'Could not load order details' : null
  metadataLoading.value = false
}

async function reload(): Promise<void> {
  const code = department.value?.code
  if (!code) return
  const requestId = ++pageRequestId
  metadataLoading.value = false
  metadataError.value = null
  await ticketStore.loadDepartment(code)
  if (requestId !== pageRequestId || ticketStore.error) return
  await loadMissingOrderDetails(requestId)
}

watch(() => department.value?.code, code => {
  expandedOrderId.value = null
  latestScanVersion += 1
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
  if (!department.value || scannerOpen.value) return
  void primeFeedbackAudio()
  latestScanVersion += 1
  scanResult.value = null
  void router.push({ query: { ...route.query, scan: '1' } }).then(() => {
    pushedScanner = scannerOpen.value
  })
}

function closeScanner(): void {
  if (!scannerOpen.value) return
  latestScanVersion += 1
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

async function advanceTicket(value: string, source: 'scan' | 'tap' | 'start'): Promise<boolean> {
  let advanced = false
  await runTagScan(value, async () => {
    const code = department.value?.code
    if (!code) return
    const version = source === 'scan' ? ++latestScanVersion : latestScanVersion
    const ticket = ticketStore.tickets.find(row => row.laundryItemId !== null && row.laundryItemId === value)
    const context = {
      title: value,
      orderId: ticket?.orderId,
      customerName: ticket ? orderInfo.value.get(ticket.orderId)?.customerName : undefined,
    }
    if (source === 'scan') scanResult.value = { ...context, message: 'Saving…', tone: 'loading' }
    const ticketId = ticket?.id
    if (ticketId) setTapState(ticketId, 'saving')
    try {
      const response = await ticketStore.scan({
        laundryItemId: value,
        department: code,
        scannedBy: currentActor(Array.isArray(route.query.by) ? route.query.by[0] : route.query.by),
      })
      advanced = response.kind === 'advanced'
      if (ticketId) setTapState(ticketId, advanced || response.kind === 'already_completed' ? null : 'failed')
      const presentation = presentScanResult(response)
      if (source === 'scan' && scannerOpen.value && department.value?.code === code) {
        feedback(feedbackOutcomeForScanResult(response))
      }
      if (department.value?.code === code) {
        const result: ScanDisplay = {
          ...context,
          status: response.kind === 'advanced' || response.kind === 'not_advanceable' ? response.status
            : response.kind === 'already_completed' ? 'Completed' : undefined,
          ...presentation,
        }
        if (source === 'scan' && version === latestScanVersion && scannerOpen.value) scanResult.value = result
        if (source === 'tap' && !advanced && response.kind !== 'already_completed') showPageNotice(result)
      }
    } catch {
      if (ticketId) setTapState(ticketId, 'failed')
      if (source === 'scan' && scannerOpen.value && department.value?.code === code) feedback('failure')
      if (department.value?.code === code) {
        const result: ScanDisplay = { ...context, message: 'Connection failed. Scan again', tone: 'error' }
        if (source === 'scan' && version === latestScanVersion && scannerOpen.value) scanResult.value = result
        if (source === 'tap') showPageNotice(result)
      }
    }
  })
  return advanced
}

async function startOrder(orderId: string): Promise<void> {
  if (startingOrderId.value !== null) return
  const departmentCode = department.value?.code
  if (!departmentCode) return
  const tickets = allOrders.value.get(orderId)?.tickets ?? []
  if (!tickets.some(ticket => ticket.status === 'Pending')) return
  startingOrderId.value = orderId
  dismissPageNotice()
  const { tags, missingTags } = pendingOrderTags(tickets)
  let advanced = 0
  let failed = 0
  try {
    for (const tag of tags) {
      if (department.value?.code !== departmentCode) return
      if (await advanceTicket(tag, 'start')) advanced += 1
      else failed += 1
    }
    if (department.value?.code !== departmentCode) return
    showPageNotice({ title: orderId, message: `${advanced} advanced · ${failed} blocked or failed · ${missingTags} skipped without tag`, tone: failed ? 'error' : missingTags ? 'warning' : 'success' })
  } finally {
    startingOrderId.value = null
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
    latestScanVersion += 1
    pushedScanner = false
    scanResult.value = null
  }
})

onBeforeUnmount(() => {
  dismissPageNotice()
  clearTapStates()
})

onBeforeRouteLeave(to => {
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
      :loading="listLoading" :error="listError"
      :empty="!listLoading && !listError && visibleTickets.length === 0"
      empty-text="No jobs with this status" :skeleton-rows="5"
    >
      <template #actions>
        <div class="flex rounded-full bg-surface-container p-0.5 font-label text-[10px]">
          <button type="button" class="flex items-center gap-1 rounded-full px-2 py-1 focus-visible:outline-2 focus-visible:outline-primary" :class="grouper === 'item' ? 'bg-primary text-on-primary' : 'text-on-surface-variant'" :aria-pressed="grouper === 'item'" aria-label="By item" @click="changeGrouper('item')"><span class="material-symbols-outlined text-[16px]" aria-hidden="true">grid_view</span><span class="hidden sm:inline">By item</span></button>
          <button type="button" class="flex items-center gap-1 rounded-full px-2 py-1 focus-visible:outline-2 focus-visible:outline-primary" :class="grouper === 'order' ? 'bg-primary text-on-primary' : 'text-on-surface-variant'" :aria-pressed="grouper === 'order'" aria-label="By order" @click="changeGrouper('order')"><span class="material-symbols-outlined text-[16px]" aria-hidden="true">view_agenda</span><span class="hidden sm:inline">By order</span></button>
        </div>
      </template>
      <template #error>
        <div class="px-4 py-6 text-center">
          <p role="alert" class="text-sm text-error">{{ listError }}</p>
          <button type="button" class="mt-3 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-on-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" @click="reload">Try again</button>
        </div>
      </template>

      <div v-if="grouper === 'item'" class="grid grid-cols-2 gap-2 p-4 sm:grid-cols-3">
        <button v-for="ticket in visibleTickets" :key="ticket.id" type="button" class="min-w-0 rounded-xl focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed" :disabled="ticket.laundryItemId === null" :aria-label="`Advance tag ${ticket.laundryItemId ?? 'missing'}; current status ${statusLabels[ticket.status]}`" @click="ticket.laundryItemId && advanceTicket(ticket.laundryItemId, 'tap')">
          <SquareImageCard :image-url="ticket.photoEvidenceUrl">
            <template #badge><TicketStatusIcon :status="ticket.status" :state="tapStates.get(ticket.id)" /></template>
          </SquareImageCard>
        </button>
      </div>

      <div v-for="order in grouper === 'order' ? visibleOrders : []" :key="order.orderId" class="bg-surface px-4 py-2">
        <div class="relative rounded-2xl border border-outline-variant/30 bg-surface-container-low">
          <button
            type="button"
            class="w-full rounded-2xl p-4 text-left focus-visible:outline-2 focus-visible:outline-primary"
            :aria-expanded="expandedOrderId === order.orderId"
            @click="expandedOrderId = expandedOrderId === order.orderId ? null : order.orderId"
          >
            <span class="flex items-start justify-between gap-2 pr-8">
              <span class="min-w-0">
                <strong class="block truncate font-headline text-sm text-primary">{{ order.customerName }}</strong>
                <span class="block truncate font-label text-xs text-on-surface-variant">{{ order.orderId }} · Due {{ formatSheetDate(order.dueDate) }}</span>
              </span>
            </span>
            <span class="mt-4 grid grid-cols-[164px_minmax(0,1fr)] items-center gap-4">
              <CompletionRing :percentage="allOrders.get(order.orderId)?.percentage ?? 0" :completed="statusCount(allOrders.get(order.orderId)?.tickets ?? [], 'Completed')" :total="allOrders.get(order.orderId)?.tickets.length ?? 0" :label="order.customerIndex ?? '-'" />
              <span class="flex min-w-0 flex-col gap-1.5">
                <span class="relative flex h-[50px] items-center gap-3 overflow-hidden rounded-2xl pl-2 pr-3 bg-warning-container"><span class="absolute inset-y-0 left-0 bg-warning/15" :style="{ width: `${statusShare(allOrders.get(order.orderId)?.tickets ?? [], 'Pending')}%` }" /><span class="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-warning/25 text-on-surface"><span class="material-symbols-outlined text-[18px]" aria-hidden="true">schedule</span></span><span class="relative flex min-w-0 flex-col justify-center"><span class="truncate font-label text-[12px] font-medium leading-4 text-on-surface/70">Pending</span><strong class="font-headline text-[22px] font-semibold leading-6 text-on-surface">{{ statusCount(allOrders.get(order.orderId)?.tickets ?? [], 'Pending') }}</strong></span></span>
                <span class="relative flex h-[50px] items-center gap-3 overflow-hidden rounded-2xl pl-2 pr-3 bg-mint/40"><span class="absolute inset-y-0 left-0 bg-secondary/10" :style="{ width: `${statusShare(allOrders.get(order.orderId)?.tickets ?? [], 'In Progress')}%` }" /><span class="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-secondary/25 text-on-surface"><span class="material-symbols-outlined text-[18px]" aria-hidden="true">autorenew</span></span><span class="relative flex min-w-0 flex-col justify-center"><span class="truncate font-label text-[12px] font-medium leading-4 text-on-surface/70">In Progress</span><strong class="font-headline text-[22px] font-semibold leading-6 text-on-surface">{{ statusCount(allOrders.get(order.orderId)?.tickets ?? [], 'In Progress') }}</strong></span></span>
                <span class="relative flex h-[50px] items-center gap-3 overflow-hidden rounded-2xl pl-2 pr-3 bg-lime/20"><span class="absolute inset-y-0 left-0 bg-lime/25" :style="{ width: `${statusShare(allOrders.get(order.orderId)?.tickets ?? [], 'Completed')}%` }" /><span class="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-lime/60 text-on-surface"><span class="material-symbols-outlined text-[18px]" aria-hidden="true">check_circle</span></span><span class="relative flex min-w-0 flex-col justify-center"><span class="truncate font-label text-[12px] font-medium leading-4 text-on-surface/70">Completed</span><strong class="font-headline text-[22px] font-semibold leading-6 text-on-surface">{{ statusCount(allOrders.get(order.orderId)?.tickets ?? [], 'Completed') }}</strong></span></span>
              </span>
            </span>
          </button>
          <button type="button" class="absolute right-4 top-4 z-10 rounded-full text-primary focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-40" aria-label="Start all pending" :disabled="startingOrderId !== null || statusCount(allOrders.get(order.orderId)?.tickets ?? [], 'Pending') === 0" @click="startOrder(order.orderId)"><span class="material-symbols-outlined" aria-hidden="true">play_arrow</span></button>
          <div v-if="expandedOrderId === order.orderId" class="grid grid-cols-2 gap-2 px-4 pb-4 sm:grid-cols-3">
            <button v-for="ticket in order.tickets" :key="ticket.id" type="button" class="min-w-0 rounded-xl focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed" :disabled="ticket.laundryItemId === null" :aria-label="`Advance tag ${ticket.laundryItemId ?? 'missing'}; current status ${statusLabels[ticket.status]}`" @click="ticket.laundryItemId && advanceTicket(ticket.laundryItemId, 'tap')">
              <SquareImageCard :image-url="ticket.photoEvidenceUrl">
                <template #badge><TicketStatusIcon :status="ticket.status" :state="tapStates.get(ticket.id)" /></template>
              </SquareImageCard>
            </button>
          </div>
        </div>
      </div>
    </ListContainer>
    <ListContainer v-else title="Department not found" icon="error" count-label="orders" empty empty-text="Unknown department" />

    <button v-if="department" type="button" :disabled="listLoading || !!listError" class="absolute bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-5 z-10 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-on-primary shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50" aria-label="Scan tag" @click="openScanner">
      <span class="material-symbols-outlined" aria-hidden="true">qr_code_scanner</span>
    </button>

    <div v-if="pageNotice && !scannerOpen" class="pointer-events-none absolute bottom-[max(1.25rem,env(safe-area-inset-bottom))] left-4 right-20 z-20">
      <div class="pointer-events-auto"><ScanResultCard :result="pageNotice" dismissible @dismiss="dismissPageNotice" /></div>
    </div>

    <QrScannerOverlay :open="scannerOpen" :title="department?.label ?? ''" @close="closeScanner" @scan="value => void advanceTicket(value, 'scan')">
      <template #result>
        <ScanResultCard v-if="scanResult" :result="scanResult" />
      </template>
    </QrScannerOverlay>
  </ListPageLayout>
</template>
