<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import type { LocationQueryRaw } from 'vue-router'
import BaseBadge from '@/shared/components/BaseBadge.vue'
import GenericTabs from '@/shared/components/GenericTabs.vue'
import ListContainer from '@/shared/components/ListContainer.vue'
import QrScannerOverlay from '@/shared/components/QrScannerOverlay.vue'
import SquareImageCard from '@/shared/components/SquareImageCard.vue'
import ListPageLayout from '@/shared/layouts/ListPageLayout.vue'
import { useJobTicketStore } from '@/data/job-tickets/job-ticket.store'
import type { JobTicketDto } from '@/data/job-tickets/job-ticket.service'
import { useWorkOrderStore } from '@/data/work-orders/work-order.store'
import { getWorkOrder, type WorkOrderDetailDto } from '@/data/work-orders/work-order.service'
import { useCustomerStore } from '@/data/customers/customer.store'
import { currentActor } from '@/shared/config/actor'
import { feedback, primeFeedbackAudio } from '@/shared/utils/scan-feedback'
import { formatSheetDate, formatSheetDateTime } from '@/shared/utils/sheet-date'
import { countDepartmentStatuses, filterTickets, groupDepartmentOrders, readDepartment, readGrouper, readStatusFilter, sortDepartmentTickets, statusFilters } from '../department-work'
import type { Grouper, OrderInfo, TicketStatus } from '../department-work'
import { createTagScanGuard, feedbackOutcomeForScanResult, presentScanResult, type ScanTone } from '../scan-result'

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
const scanResult = ref<{ tagId: string; orderId?: string; customerName?: string; status?: TicketStatus; message: string; tone: ScanTone } | null>(null)
const orderDetails = shallowRef(new Map<string, WorkOrderDetailDto>())
const metadataLoading = ref(false)
const metadataError = ref<string | null>(null)
const detailPromises = new Map<string, Promise<void>>()
const runTagScan = createTagScanGuard()
let pageRequestId = 0
let latestScanVersion = 0
let pushedScanner = false
let replacingLeave = false

const statusLabels: Record<TicketStatus, string> = {
  Pending: 'รอดำเนินการ',
  'In Progress': 'กำลังดำเนินการ',
  Completed: 'เสร็จแล้ว',
  Cancelled: 'ยกเลิก',
}
const statusTones = { Pending: 'warning', 'In Progress': 'info', Completed: 'success', Cancelled: 'danger' } as const
const filterLabels = { ALL: 'ทั้งหมด', PENDING: 'รอดำเนินการ', 'IN PROGRESS': 'กำลังดำเนินการ', COMPLETED: 'เสร็จแล้ว' } as const
const counts = computed(() => countDepartmentStatuses(ticketStore.tickets))
const tabs = computed(() => statusFilters.map(key => ({ key, label: filterLabels[key], count: counts.value[key] })))
const listLoading = computed(() => ticketStore.loading || metadataLoading.value)
const listError = computed(() => ticketStore.error || metadataError.value)

const orderInfo = computed(() => {
  const listed = new Map(workOrderStore.orders.map(order => [order.orderId, order]))
  const customers = new Map(customerStore.customers.map(customer => [customer.customerId, customer.customerName]))
  const info = new Map<string, OrderInfo>()
  for (const ticket of ticketStore.tickets) {
    if (info.has(ticket.orderId)) continue
    const order = listed.get(ticket.orderId) ?? orderDetails.value.get(ticket.orderId)
    const customerId = order?.customerId ?? ticket.customerId
    info.set(ticket.orderId, {
      dueDate: order?.dueDate ?? ticket.dueDate ?? null,
      customerId,
      customerName: (customerId && customers.get(customerId)) || customerId || ticket.orderId,
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
  metadataError.value = results.some(result => result.status === 'rejected') ? 'โหลดข้อมูลออเดอร์ไม่สำเร็จ' : null
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

function handleScan(value: string): void {
  void runTagScan(value, async () => {
    const code = department.value?.code
    if (!code) return
    const version = ++latestScanVersion
    const ticket = ticketStore.tickets.find(row => row.laundryItemId === value)
    const context = {
      tagId: value,
      orderId: ticket?.orderId,
      customerName: ticket ? orderInfo.value.get(ticket.orderId)?.customerName : undefined,
    }
    scanResult.value = { ...context, message: 'กำลังบันทึก…', tone: 'loading' }
    try {
      const response = await ticketStore.scan({
        laundryItemId: value,
        department: code,
        scannedBy: currentActor(Array.isArray(route.query.by) ? route.query.by[0] : route.query.by),
      })
      const presentation = presentScanResult(response)
      if (scannerOpen.value && department.value?.code === code) {
        feedback(feedbackOutcomeForScanResult(response))
      }
      if (version === latestScanVersion && scannerOpen.value && department.value?.code === code) {
        scanResult.value = {
          ...context,
          status: response.kind === 'advanced' || response.kind === 'not_advanceable' ? response.status
            : response.kind === 'already_completed' ? 'Completed' : undefined,
          ...presentation,
        }
      }
    } catch {
      if (scannerOpen.value && department.value?.code === code) feedback('failure')
      if (version === latestScanVersion && scannerOpen.value && department.value?.code === code) {
        scanResult.value = { ...context, message: 'เชื่อมต่อไม่สำเร็จ ลองสแกนอีกครั้ง', tone: 'error' }
      }
    }
  })
}

function ticketSecondary(ticket: JobTicketDto): string {
  const time = ticket.status === 'Completed' ? ticket.completedAt : ticket.startedAt
  return `${statusLabels[ticket.status]}${time ? ` · ${formatSheetDateTime(time)}` : ''}`
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
      รายการไม่ครบ: แสดงได้สูงสุด 2,000 งาน
    </div>

    <ListContainer
      v-if="department"
      :title="department.label" icon="assignment"
      :count="grouper === 'order' ? visibleOrders.length : visibleTickets.length"
      :count-label="grouper === 'order' ? 'orders' : 'items'"
      :loading="listLoading" :error="listError"
      :empty="!listLoading && !listError && visibleTickets.length === 0"
      empty-text="ไม่มีงานในสถานะนี้" :skeleton-rows="5"
    >
      <template #actions>
        <div class="flex rounded-full bg-surface-container p-0.5 font-label text-[10px]">
          <button type="button" class="flex items-center gap-1 rounded-full px-2 py-1 focus-visible:outline-2 focus-visible:outline-primary" :class="grouper === 'item' ? 'bg-primary text-on-primary' : 'text-on-surface-variant'" :aria-pressed="grouper === 'item'" aria-label="รายชิ้น" @click="changeGrouper('item')"><span class="material-symbols-outlined text-[16px]" aria-hidden="true">grid_view</span><span class="hidden sm:inline">รายชิ้น</span></button>
          <button type="button" class="flex items-center gap-1 rounded-full px-2 py-1 focus-visible:outline-2 focus-visible:outline-primary" :class="grouper === 'order' ? 'bg-primary text-on-primary' : 'text-on-surface-variant'" :aria-pressed="grouper === 'order'" aria-label="ตามออเดอร์" @click="changeGrouper('order')"><span class="material-symbols-outlined text-[16px]" aria-hidden="true">view_agenda</span><span class="hidden sm:inline">ตามออเดอร์</span></button>
        </div>
      </template>
      <template #error>
        <div class="px-4 py-6 text-center">
          <p role="alert" class="text-sm text-error">{{ listError }}</p>
          <button type="button" class="mt-3 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-on-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" @click="reload">ลองใหม่</button>
        </div>
      </template>

      <div v-if="grouper === 'item'" class="grid grid-cols-2 gap-x-3 gap-y-5 p-4 sm:grid-cols-3">
        <SquareImageCard v-for="ticket in visibleTickets" :key="ticket.id" :image-url="ticket.photoEvidenceUrl" :primary-text="ticket.laundryItemId" :secondary-text="ticketSecondary(ticket)">
          <template #badge><BaseBadge :label="statusLabels[ticket.status]" :tone="statusTones[ticket.status]" size="sm" /></template>
        </SquareImageCard>
      </div>

      <div v-for="order in grouper === 'order' ? visibleOrders : []" :key="order.orderId" class="bg-surface px-4 py-2">
        <button
          type="button"
          class="w-full rounded-2xl border border-outline-variant/30 bg-surface-container-low p-4 text-left focus-visible:outline-2 focus-visible:outline-primary"
          :aria-expanded="expandedOrderId === order.orderId"
          @click="expandedOrderId = expandedOrderId === order.orderId ? null : order.orderId"
        >
          <span class="flex items-start justify-between gap-2">
            <span class="min-w-0">
              <strong class="block truncate font-headline text-sm text-primary">{{ order.customerName }}</strong>
              <span class="block truncate font-label text-xs text-on-surface-variant">{{ order.orderId }} · กำหนด {{ formatSheetDate(order.dueDate) }}</span>
            </span>
            <span class="material-symbols-outlined text-primary" aria-hidden="true">{{ expandedOrderId === order.orderId ? 'expand_less' : 'expand_more' }}</span>
          </span>
          <span class="mt-3 grid grid-cols-[104px_minmax(0,1fr)] items-center gap-3">
            <span class="relative flex h-[104px] w-[104px] items-center justify-center">
              <svg viewBox="0 0 100 100" class="absolute inset-0 h-full w-full -rotate-90" aria-hidden="true">
                <circle cx="50" cy="50" r="43" fill="none" stroke="currentColor" stroke-width="11" class="text-surface-container" />
                <circle cx="50" cy="50" r="43" fill="none" stroke="currentColor" stroke-width="11" stroke-linecap="round" pathLength="100" :stroke-dasharray="`${allOrders.get(order.orderId)?.percentage ?? 0} 100`" class="text-primary" />
              </svg>
              <span class="relative text-center">
                <span class="block font-headline text-xl font-bold text-primary">{{ allOrders.get(order.orderId)?.percentage ?? 0 }}%</span>
                <span class="block font-label text-[10px] text-on-surface-variant">{{ statusCount(allOrders.get(order.orderId)?.tickets ?? [], 'Completed') }} of {{ allOrders.get(order.orderId)?.tickets.length ?? 0 }}</span>
              </span>
            </span>
            <span class="flex min-w-0 flex-col gap-1.5">
              <span class="flex items-center gap-2 rounded-xl bg-warning-container px-2 py-1.5 text-on-warning-container"><span class="material-symbols-outlined text-[16px]" aria-hidden="true">schedule</span><span class="min-w-0 flex-1 truncate font-label text-xs">รอดำเนินการ</span><strong class="text-sm">{{ statusCount(allOrders.get(order.orderId)?.tickets ?? [], 'Pending') }}</strong></span>
              <span class="flex items-center gap-2 rounded-xl bg-secondary-container px-2 py-1.5 text-on-secondary-container"><span class="material-symbols-outlined text-[16px]" aria-hidden="true">autorenew</span><span class="min-w-0 flex-1 truncate font-label text-xs">กำลังทำ</span><strong class="text-sm">{{ statusCount(allOrders.get(order.orderId)?.tickets ?? [], 'In Progress') }}</strong></span>
              <span class="flex items-center gap-2 rounded-xl bg-success-container px-2 py-1.5 text-on-success-container"><span class="material-symbols-outlined text-[16px]" aria-hidden="true">check_circle</span><span class="min-w-0 flex-1 truncate font-label text-xs">เสร็จแล้ว</span><strong class="text-sm">{{ statusCount(allOrders.get(order.orderId)?.tickets ?? [], 'Completed') }}</strong></span>
            </span>
          </span>
        </button>
        <div v-if="expandedOrderId === order.orderId" class="grid grid-cols-2 gap-x-3 gap-y-5 p-3 sm:grid-cols-3">
          <SquareImageCard v-for="ticket in order.tickets" :key="ticket.id" :image-url="ticket.photoEvidenceUrl" :primary-text="ticket.laundryItemId" :secondary-text="ticketSecondary(ticket)">
            <template #badge><BaseBadge :label="statusLabels[ticket.status]" :tone="statusTones[ticket.status]" size="sm" /></template>
          </SquareImageCard>
        </div>
      </div>
    </ListContainer>
    <ListContainer v-else title="ไม่พบแผนก" icon="error" count-label="orders" empty empty-text="ไม่รู้จักแผนกนี้" />

    <button v-if="department" type="button" :disabled="listLoading || !!listError" class="absolute bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-5 z-10 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-on-primary shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50" aria-label="สแกนแท็ก" @click="openScanner">
      <span class="material-symbols-outlined" aria-hidden="true">qr_code_scanner</span>
    </button>

    <QrScannerOverlay :open="scannerOpen" :title="department?.label ?? ''" @close="closeScanner" @scan="handleScan">
      <template #result>
        <div v-if="scanResult" role="status" class="mx-auto max-w-sm rounded-xl p-4 font-body shadow-lg" :class="scanResult.tone === 'success' ? 'bg-success-container text-on-success-container' : scanResult.tone === 'warning' ? 'bg-warning-container text-on-warning-container' : scanResult.tone === 'error' ? 'bg-error-container text-on-error-container' : 'bg-surface text-on-surface'">
          <p class="font-headline font-bold">{{ scanResult.tagId }}</p>
          <p v-if="scanResult.orderId" class="text-sm">{{ scanResult.customerName }} · {{ scanResult.orderId }}</p>
          <p v-if="scanResult.status" class="text-sm">สถานะ {{ statusLabels[scanResult.status] }}</p>
          <p class="mt-1 text-sm font-semibold">{{ scanResult.message }}</p>
        </div>
      </template>
    </QrScannerOverlay>
  </ListPageLayout>
</template>
