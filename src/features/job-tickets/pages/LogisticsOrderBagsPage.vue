<script setup lang="ts">
import { computed, onActivated, onBeforeUnmount, ref, watch } from 'vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRoute, useRouter } from 'vue-router'
import AppLayout from '@/shared/layouts/AppLayout.vue'
import ScrollRegion from '@/shared/components/ScrollRegion.vue'
import StickerFab from '@/shared/components/StickerFab.vue'
import QrScannerOverlay from '@/shared/components/QrScannerOverlay.vue'
import { listOrderImages, type OrderImageDto } from '@/data/order-images/order-image.service'
import { advanceJobTickets, listJobTickets, type JobTicketDto } from '@/data/job-tickets/job-ticket.service'
import { getWorkOrder, type WorkOrderDetailDto } from '@/data/work-orders/work-order.service'
import { useCustomerStore } from '@/data/customers/customer.store'
import { filterTickets } from '../department-work'
import { currentActor } from '@/shared/config/actor'
import { feedback, primeFeedbackAudio } from '@/shared/utils/scan-feedback'
import { invalidate } from '@/shared/api/response-cache'
import { normalizeSheetTimestamp } from '@shared/utils/bangkok-datetime'

const props = defineProps<{ orderId: string }>()
const route = useRoute()
const router = useRouter()
const customerStore = useCustomerStore()
const order = ref<WorkOrderDetailDto | null>(null)
const images = ref<OrderImageDto[]>([])
const tickets = ref<JobTicketDto[]>([])
const scannedTicketIds = ref(new Set<string>())
const loading = ref(true)
const error = ref<string | null>(null)
const submitting = ref(false)
const notice = ref<{ message: string; success: boolean } | null>(null)
const scannerOpen = computed(() => route.name === 'logistics-order-bags' && route.params.orderId === props.orderId && route.query.scan === '1')
const customer = computed(() => customerStore.customers.find(row => row.customerId === order.value?.customerId))
const bags = computed(() => {
  const weights = new Map(images.value.map(image => [image.orderImageId, image.quantity]))
  const prefix = `LOG-${props.orderId}-`
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
  const sequence = ++loadSequence
  const orderId = props.orderId
  loading.value = true
  error.value = null
  notice.value = null
  scannedTicketIds.value = new Set()
  try {
    const [header, photos, jobs] = await Promise.all([
      getWorkOrder(orderId),
      (async () => {
        const rows: OrderImageDto[] = []
        for (let page = 1; ; page += 1) {
          const result = await listOrderImages(orderId, page)
          rows.push(...result.items)
          if (result.items.length < 500) return rows
        }
      })(),
      (async () => {
        const rows: JobTicketDto[] = []
        for (let page = 1; ; page += 1) {
          const result = await listJobTickets({ orderId, department: 'Logistics', page, perPage: 500 })
          rows.push(...result.items)
          if (result.items.length < 500) return rows
        }
      })(),
    ])
    if (sequence !== loadSequence) return
    order.value = header
    images.value = photos
    tickets.value = filterTickets(jobs, 'ALL', 'Logistics').filter(ticket => ticket.orderId === orderId)
  } catch (reason) {
    if (sequence === loadSequence) error.value = reason instanceof Error ? reason.message : 'Unable to load bags'
  } finally {
    if (sequence === loadSequence) loading.value = false
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
  const orderId = props.orderId
  const entries = [...scannedTicketIds.value].map(ticketId => ({ ticketId, orderId }))
  const actor = currentActor()
  submitting.value = true
  try {
    const result = await advanceJobTickets({ department: 'Logistics', fromStatus: 'Pending', scannedBy: actor, tickets: entries })
    if (orderId !== props.orderId) return
    scannedTicketIds.value = new Set()
    if (result.kind === 'completed') {
      const advanced = new Map(result.advanced.map(row => [row.ticketId, row]))
      tickets.value = tickets.value.map(ticket => {
        const update = advanced.get(ticket.id)
        return update ? { ...ticket, status: update.status, startedAt: update.startedAt, scannedBy: actor } : ticket
      })
      if (result.advanced.length !== entries.length) {
        await load()
        showNotice(`${result.advanced.length} bags started. Other bag statuses changed; check before scanning again`)
      } else showNotice(`${result.advanced.length} bags started`, true)
    } else {
      await load()
      showNotice(result.certainty === 'unknown' ? 'Scans could not be confirmed. Check the bags before scanning again' : 'Unable to save scans. Please try again')
    }
  } catch (reason) {
    if (orderId === props.orderId) {
      await load()
      showNotice(reason instanceof Error ? reason.message : 'Unable to save scans. Check the bags before scanning again')
    }
  } finally {
    submitting.value = false
    invalidate('/api/job-tickets')
    if (orderId === props.orderId) closeScanner()
  }
}

watch(() => props.orderId, () => { order.value = null; images.value = []; tickets.value = []; void load() })
watch(scannerOpen, open => {
  if (!open) { pushedScanner = false; scannedTicketIds.value = new Set() }
})
onBeforeRouteUpdate(() => { if (submitting.value) return false })
onActivated(() => { void load() })
onBeforeUnmount(() => { loadSequence += 1; if (noticeTimer) clearTimeout(noticeTimer) })
onBeforeRouteLeave(to => {
  if (submitting.value) return false
  if (!scannerOpen.value || replacingLeave) return
  replacingLeave = true
  pushedScanner = false
  void router.replace(to).finally(() => { replacingLeave = false })
  return false
})
</script>

<template>
  <AppLayout>
    <ScrollRegion as="main" class="bg-surface pb-32">
      <section v-if="order && !loading && !error" class="relative mx-3 mt-4 overflow-hidden rounded-[20px] border border-lime/25 bg-primary text-on-primary shadow-lg">
        <div class="pointer-events-none absolute -right-[138px] -top-[112px] h-[270px] w-[270px] rounded-full border-[34px] border-lime/15" />
        <div class="relative grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 px-5 pb-3 pt-4">
          <p class="truncate font-label text-[9px] font-bold uppercase tracking-widest text-lime">Customer · {{ customer?.customerIndex ?? '—' }}</p>
          <p class="text-right font-label text-[9px] font-bold uppercase tracking-widest text-lime">Total weight</p>
          <h1 class="mt-0.5 truncate font-headline text-[26px] font-bold leading-8">{{ customer?.customerName ?? order.customerId }}</h1>
          <p class="mt-0.5 whitespace-nowrap text-right font-headline text-[30px] font-extrabold leading-8 text-lime">{{ totalWeight }}<span class="ml-1 font-body text-sm font-bold text-on-primary/80">kg</span></p>
        </div>
        <div class="relative mx-5 border-t border-white/15 pb-4 pt-3">
          <p class="font-label text-[9px] font-bold uppercase tracking-widest text-lime">Bags scanned</p>
          <div class="mt-3 flex h-1.5 gap-1" role="progressbar" aria-label="Bags scanned" :aria-valuemin="0" :aria-valuemax="bags.length" :aria-valuenow="scannedCount">
            <div v-for="bag in bags" :key="bag.orderImageId" class="flex-1 rounded-full" :class="bag.scanned ? 'bg-lime' : 'bg-white/20'" />
            <div v-if="!bags.length" class="flex-1 rounded-full bg-white/20" />
          </div>
          <div class="mt-2 flex items-baseline justify-between gap-3">
            <p class="font-body text-xs font-bold" :class="complete ? 'text-lime' : 'text-on-primary/80'">{{ !bags.length ? 'No bag tickets yet' : complete ? 'All bags scanned · ready for delivery' : `${bags.length - scannedCount} bags left to scan` }}</p>
            <p class="whitespace-nowrap font-body text-xs font-bold tabular-nums" :class="complete ? 'text-lime' : 'text-on-primary/80'">{{ scannedCount }} / {{ bags.length }}</p>
          </div>
        </div>
      </section>
      <section class="mx-3 mt-5">
        <header class="mb-2.5 flex items-center justify-between gap-3"><div class="border-l-4 border-lime pl-2.5"><h2 class="font-headline text-[17px] font-extrabold tracking-[-0.03em] text-primary">Weight photos</h2><p class="mt-[3px] font-label text-[9px] font-bold uppercase leading-none tracking-[0.1em] text-on-surface-variant">Scan every bag before delivery</p></div><p v-if="!loading && !error" class="shrink-0 font-label text-[10px] font-extrabold uppercase tracking-[0.04em] text-on-surface-variant">{{ scannedCount }} of {{ bags.length }} scanned</p></header>
        <div v-if="loading" class="grid gap-2" aria-busy="true"><div v-for="row in 3" :key="row" class="h-[76px] animate-pulse rounded-[14px] bg-surface-container" /></div>
        <div v-else-if="error" class="rounded-[14px] bg-white p-4 text-sm text-error"><p role="alert">{{ error }}</p><button type="button" class="mt-2 rounded px-3 py-2 font-bold focus-visible:outline-2 focus-visible:outline-lime" @click="load">Retry</button></div>
        <div v-else-if="!bags.length" class="flex flex-col items-center rounded-[14px] bg-white px-4 py-7 text-center shadow-[0_1px_0_rgba(7,63,56,0.05)]"><span class="grid h-14 w-14 -rotate-[7deg] place-items-center rounded-[18px] bg-secondary-container text-on-secondary-container"><span class="material-symbols-outlined text-[28px]" aria-hidden="true">inventory_2</span></span><p class="mt-3 font-body text-sm font-extrabold text-on-surface">No bag tickets yet</p><p class="mt-1 font-body text-[13px] text-on-surface-variant">Logistics bag tickets appear here to be scanned.</p></div>
        <ol v-else class="grid gap-2">
          <li v-for="bag in bags" :key="bag.orderImageId" class="grid grid-cols-[52px_minmax(0,1fr)_56px] items-center gap-2.5 rounded-[14px] bg-white px-3 py-2.5 shadow-[0_1px_0_rgba(7,63,56,0.05)]">
            <p v-if="bag.weight !== null" class="flex flex-col items-end border-r pr-2 text-primary" :class="bag.scanned ? 'border-lime/60' : 'border-outline-variant'"><span class="font-headline text-[22px] font-extrabold leading-none tabular-nums">{{ bag.weight }}</span><span class="mt-1 font-label text-[11px] text-on-surface-variant">kg</span></p>
            <div class="min-w-0" :class="bag.weight === null ? 'col-span-2' : ''"><p class="truncate font-body text-sm font-extrabold">Bag {{ bag.orderImageId }}</p><p class="mt-1 font-label text-[10px] font-extrabold uppercase" :class="bag.scanned ? 'text-success' : 'text-on-surface-variant'">{{ bag.scanned ? 'Scanned' : 'Pending' }}</p></div>
            <div class="relative h-14 w-14"><div class="h-full overflow-hidden rounded-[10px] bg-surface-container" :class="bag.scanned ? '' : 'opacity-60 saturate-50'"><img v-if="bag.ticket.photoEvidenceUrl && /^https?:\/\//.test(bag.ticket.photoEvidenceUrl)" :src="bag.ticket.photoEvidenceUrl" :alt="`Bag ${bag.orderImageId} photo`" class="h-full w-full object-cover"><span v-else class="material-symbols-outlined grid h-full place-items-center text-on-surface-variant" aria-hidden="true">image</span></div><span v-if="bag.scanned" class="material-symbols-outlined absolute -right-1.5 -top-1.5 grid h-6 w-6 place-items-center rounded-full border-2 border-surface bg-lime text-[15px] text-primary" aria-hidden="true">check</span><span v-else class="absolute -right-1.5 -top-1.5 h-6 w-6 rounded-full border-2 border-dashed border-outline-variant bg-surface" /></div>
          </li>
        </ol>
      </section>
    </ScrollRegion>
    <StickerFab class="absolute bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-5 z-10" label="Scan" aria-label="Scan bag tag" :disabled="loading || !!error || !bags.length || submitting" @click="openScanner"><span class="material-symbols-outlined text-[36px]" aria-hidden="true">qr_code_scanner</span></StickerFab>
    <div v-if="notice && !scannerOpen" :role="notice.success ? 'status' : 'alert'" class="absolute bottom-[max(1.25rem,env(safe-area-inset-bottom))] left-4 right-24 z-20 rounded-xl px-3 py-3 font-body text-sm shadow-lg" :class="notice.success ? 'bg-success-container text-on-success-container' : 'bg-error-container text-on-error-container'">{{ notice.message }}</div>
    <QrScannerOverlay :open="scannerOpen" title="Scan bags" @close="closeScanner" @scan="handleScan">
      <template #result><p class="mb-2 font-label text-sm font-bold">{{ scannedCount }} of {{ bags.length }} scanned</p><p v-if="notice" :role="notice.success ? 'status' : 'alert'" class="rounded-xl px-3 py-3 font-body text-sm" :class="notice.success ? 'bg-success-container text-on-success-container' : 'bg-error-container text-on-error-container'">{{ notice.message }}</p><p v-if="submitting" role="status" class="mt-2 text-sm">Saving scans…</p><button type="button" class="mt-3 rounded-full bg-lime px-5 py-2 font-label text-sm font-bold text-primary focus-visible:outline-2 focus-visible:outline-lime disabled:opacity-40" :disabled="!scannedTicketIds.size || submitting || loading || !!error" @click="confirmScans">Confirm {{ scannedTicketIds.size }} bags</button></template>
    </QrScannerOverlay>
  </AppLayout>
</template>
