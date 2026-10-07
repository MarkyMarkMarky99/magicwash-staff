<script setup lang="ts">
import { computed, onActivated, onBeforeUnmount, ref, watch } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import AppLayout from '@/shared/layouts/AppLayout.vue'
import ScrollRegion from '@/shared/components/ScrollRegion.vue'
import ListContainer from '@/shared/components/ListContainer.vue'
import BaseBadge from '@/shared/components/BaseBadge.vue'
import StickerFab from '@/shared/components/StickerFab.vue'
import QrScannerOverlay from '@/shared/components/QrScannerOverlay.vue'
import { listOrderImages, type OrderImageDto } from '@/data/order-images/order-image.service'
import { advanceJobTickets, listJobTickets, type JobTicketDto } from '@/data/job-tickets/job-ticket.service'
import { getWorkOrder, type WorkOrderDetailDto } from '@/data/work-orders/work-order.service'
import { useCustomerStore } from '@/data/customers/customer.store'
import { currentActor } from '@/shared/config/actor'
import { feedback, primeFeedbackAudio } from '@/shared/utils/scan-feedback'
import { formatSheetDateTime } from '@/shared/utils/sheet-date'
import { normalizeSheetTimestamp } from '@shared/utils/bangkok-datetime'
import { presentationFor } from '../order-status-presentation'

const props = defineProps<{ orderId: string }>()
const route = useRoute()
const router = useRouter()
const customerStore = useCustomerStore()
const order = ref<WorkOrderDetailDto | null>(null)
const images = ref<OrderImageDto[]>([])
const tickets = ref<JobTicketDto[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const submitting = ref(false)
const notice = ref<{ message: string; success: boolean } | null>(null)
const scannerOpen = computed(() => route.name === 'order-bag-scan' && route.params.orderId === props.orderId && route.query.scan === '1')
const customer = computed(() => customerStore.customers.find(row => row.customerId === order.value?.customerId))
const bags = computed(() => images.value.map((image, index) => {
  const ticket = tickets.value.find(row => row.id === `LOG-${props.orderId}-${image.orderImageId}-LOG-BAG`)
  return { image, number: index + 1, ticket, scanned: ticket?.status === 'In Progress' || ticket?.status === 'Completed' }
}))
const scannedCount = computed(() => bags.value.filter(bag => bag.scanned).length)
const totalWeight = computed(() => Math.round(images.value.reduce((total, image) => total + (image.quantity ?? 0), 0) * 100) / 100)
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
    images.value = photos.filter(image => image.imageType === 'WEIGHT')
      .sort((a, b) => normalizeSheetTimestamp(a.createdAt).localeCompare(normalizeSheetTimestamp(b.createdAt)) || a.orderImageId.localeCompare(b.orderImageId))
    tickets.value = jobs.filter(ticket => ticket.department === 'Logistics' && ticket.taskCode === 'LOG-BAG' && !ticket.deletedAt)
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
  primeFeedbackAudio()
  void router.push({ query: { ...route.query, scan: '1' } }).then(() => { pushedScanner = scannerOpen.value })
}

function closeScanner(): void {
  if (pushedScanner) {
    pushedScanner = false
    router.back()
  } else {
    const query = { ...route.query }
    delete query.scan
    void router.replace({ query })
  }
}

async function handleScan(value: string): Promise<void> {
  if (submitting.value || loading.value || error.value) return
  const text = value.trim()
  const marker = text.lastIndexOf('/b/')
  const id = marker === -1 ? text : text.slice(marker + 3).trim()
  const bag = bags.value.find(row => row.image.orderImageId === id)
  if (!bag) return showNotice('This bag belongs to another order')
  if (!bag.ticket) return showNotice('No delivery ticket for this bag')
  if (bag.scanned) return showNotice(`Bag ${bag.number} already scanned`)
  if (bag.ticket.status !== 'Pending') return showNotice(`Bag ${bag.number} cannot be scanned`)
  const orderId = props.orderId
  const ticket = bag.ticket
  submitting.value = true
  try {
    const result = await advanceJobTickets({ department: 'Logistics', fromStatus: 'Pending', scannedBy: currentActor(),
      tickets: [{ ticketId: ticket.id, orderId }] })
    if (orderId !== props.orderId) return
    if (result.kind === 'completed') {
      const advanced = result.advanced.find(row => row.ticketId === ticket.id)
      if (advanced) {
        tickets.value = tickets.value.map(row => row.id === ticket.id ? { ...row, status: advanced.status, startedAt: advanced.startedAt } : row)
        showNotice(`Bag ${bag.number} scanned`, true)
      } else {
        await load()
        showNotice('Bag status changed. Please scan again')
      }
    } else {
      if (result.certainty === 'unknown') await load()
      showNotice(result.certainty === 'unknown' ? 'Scan could not be confirmed. Please scan again' : 'Unable to scan bag. Please try again')
    }
  } catch (reason) {
    if (orderId === props.orderId) showNotice(reason instanceof Error ? reason.message : 'Unable to scan bag')
  } finally {
    submitting.value = false
  }
}

watch(() => props.orderId, () => { order.value = null; images.value = []; tickets.value = []; void load() })
watch(scannerOpen, open => { if (!open) pushedScanner = false })
onActivated(() => { void load() })
onBeforeUnmount(() => { loadSequence += 1; if (noticeTimer) clearTimeout(noticeTimer) })
onBeforeRouteLeave(to => {
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
          <p class="mt-0.5 text-right font-headline text-[30px] font-extrabold leading-8 text-lime">{{ totalWeight }}</p>
          <p class="mt-1 font-body text-xs text-on-primary/80">Order {{ orderId }}</p>
          <p class="mt-1 text-right font-body text-xs text-on-primary/80">kg</p>
        </div>
        <div class="relative mx-5 border-t border-white/15 pb-6 pt-3">
          <div class="flex items-end justify-between gap-3">
            <p class="font-label text-[9px] font-bold uppercase tracking-widest text-lime">Bags scanned</p>
            <BaseBadge :label="presentationFor(order.status).label" :tone="presentationFor(order.status).tone" size="sm" />
          </div>
          <p class="mt-1 font-headline"><span class="text-[40px] font-extrabold tabular-nums" :class="complete ? 'text-lime' : ''">{{ scannedCount }}</span><span v-if="bags.length" class="text-[22px] font-bold text-on-primary/60"> / {{ bags.length }}</span></p>
          <div class="mt-2 flex h-1.5 gap-1" role="progressbar" aria-label="Bags scanned" :aria-valuemin="0" :aria-valuemax="bags.length" :aria-valuenow="scannedCount">
            <div v-for="bag in bags" :key="bag.image.orderImageId" class="flex-1 rounded-full" :class="bag.scanned ? 'bg-lime' : 'bg-white/20'" />
            <div v-if="!bags.length" class="flex-1 rounded-full bg-white/20" />
          </div>
          <p class="mt-2 font-body text-xs font-bold" :class="complete ? 'text-lime' : 'text-on-primary/80'">{{ !bags.length ? 'No bags weighed yet' : complete ? 'All bags scanned · ready for delivery' : `${bags.length - scannedCount} bags left to scan` }}</p>
        </div>
      </section>
      <div class="mx-3 mt-5">
        <ListContainer class="overflow-hidden rounded-2xl" title="Weight photos" icon="scale" :count="scannedCount" :count-label="`of ${bags.length} scanned`" :loading="loading" :error="error" :empty="!bags.length" :skeleton-rows="3">
          <template #error><div class="p-4 text-sm text-error"><p role="alert">{{ error }}</p><button type="button" class="mt-2 rounded px-3 py-2 font-bold focus-visible:outline-2 focus-visible:outline-lime" @click="load">Retry</button></div></template>
          <template #empty><div class="px-4 py-7 text-center"><span class="material-symbols-outlined text-primary text-[28px]" aria-hidden="true">scale</span><p class="mt-3 font-body text-sm font-bold">No weight photos yet</p><p class="mt-1 font-body text-[13px] text-on-surface-variant">Bags weighed at the counter appear here to be scanned.</p></div></template>
          <ol class="grid gap-2 bg-surface pt-2">
            <li v-for="bag in bags" :key="bag.image.orderImageId" class="grid grid-cols-[52px_minmax(0,1fr)_56px] items-center gap-2.5 rounded-[14px] bg-surface-container-lowest px-3 py-2.5 shadow-sm">
              <p class="flex flex-col items-end border-r pr-2 text-primary" :class="bag.scanned ? 'border-lime/60' : 'border-outline-variant'"><span class="font-headline text-[22px] font-extrabold leading-none tabular-nums">{{ bag.image.quantity ?? '—' }}</span><span class="mt-1 font-label text-[11px] text-on-surface-variant">kg</span></p>
              <div class="min-w-0"><p class="truncate font-body text-sm font-extrabold">Bag {{ bag.number }} · {{ bag.image.createdBy ?? '—' }}</p><p class="mt-1 font-label text-[10px] text-on-surface-variant">{{ formatSheetDateTime(bag.image.createdAt) }}</p><p class="mt-1 font-label text-[10px] font-extrabold uppercase" :class="bag.scanned ? 'text-success' : 'text-on-surface-variant'">{{ bag.scanned ? 'Scanned' : 'To scan' }}</p></div>
              <div class="relative h-14 w-14"><div class="h-full overflow-hidden rounded-[10px] bg-surface-container" :class="bag.scanned ? '' : 'opacity-60 saturate-50'"><img v-if="bag.image.imagePath?.startsWith('https://')" :src="bag.image.imagePath" :alt="`Bag ${bag.number} weight photo`" class="h-full w-full object-cover"><span v-else class="material-symbols-outlined grid h-full place-items-center text-on-surface-variant" aria-hidden="true">image</span></div><span v-if="bag.scanned" class="material-symbols-outlined absolute -right-1.5 -top-1.5 grid h-6 w-6 place-items-center rounded-full border-2 border-surface bg-lime text-[15px] text-primary" aria-hidden="true">check</span><span v-else class="absolute -right-1.5 -top-1.5 h-6 w-6 rounded-full border-2 border-dashed border-outline-variant bg-surface" /></div>
            </li>
          </ol>
        </ListContainer>
        <p v-if="!loading && !error" class="mt-2 font-label text-xs text-on-surface-variant">Scan every bag before delivery</p>
      </div>
    </ScrollRegion>
    <StickerFab class="absolute bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-5 z-10" label="Scan" aria-label="Scan bag tag" :disabled="loading || !!error || !bags.length || submitting" @click="openScanner"><span class="material-symbols-outlined text-[36px]" aria-hidden="true">qr_code_scanner</span></StickerFab>
    <div v-if="notice && !scannerOpen" :role="notice.success ? 'status' : 'alert'" class="absolute bottom-[max(1.25rem,env(safe-area-inset-bottom))] left-4 right-24 z-20 rounded-xl px-3 py-3 font-body text-sm shadow-lg" :class="notice.success ? 'bg-success-container text-on-success-container' : 'bg-error-container text-on-error-container'">{{ notice.message }}</div>
    <QrScannerOverlay :open="scannerOpen" title="Scan bags" @close="closeScanner" @scan="handleScan">
      <template #result><p class="mb-2 font-label text-sm font-bold">{{ scannedCount }} of {{ bags.length }} scanned</p><p v-if="notice" :role="notice.success ? 'status' : 'alert'" class="rounded-xl px-3 py-3 font-body text-sm" :class="notice.success ? 'bg-success-container text-on-success-container' : 'bg-error-container text-on-error-container'">{{ notice.message }}</p><p v-if="submitting" role="status" class="mt-2 text-sm">Saving scan…</p></template>
    </QrScannerOverlay>
  </AppLayout>
</template>
