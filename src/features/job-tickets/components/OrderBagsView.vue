<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRoute, useRouter } from 'vue-router'
import ConfirmOverlay from '@/shared/layouts/ConfirmOverlay.vue'
import CameraOverlay from '@/shared/components/CameraOverlay.vue'
import QrScannerOverlay from '@/shared/components/QrScannerOverlay.vue'
import ScrollRegion from '@/shared/components/ScrollRegion.vue'
import StickerFab from '@/shared/components/StickerFab.vue'
import { feedback, primeFeedbackAudio } from '@/shared/utils/scan-feedback'
import AddBagCard from './AddBagCard.vue'
import OrderBagRow, { type BagRowTone } from './OrderBagRow.vue'
import OrderBagSummary, { type SummarySegment } from './OrderBagSummary.vue'
import PackagingBagSheet from './PackagingBagSheet.vue'
import ScanResultCard from './ScanResultCard.vue'
import { useLogisticsBags } from '../composables/useLogisticsBags'
import { usePackagingBags } from '../composables/usePackagingBags'
import { useQueryOverlay } from '../composables/useQueryOverlay'
import { confirmedItemCount, formatConfirmedAt, garmentState, packedCount } from '../packaging-bags'
import type { ScanDisplay } from '../scan-result'

// One view for every department's order bag page; the department only picks the workflow and wording.
// The page keys this view by department, so the choice below is made once per instance.
const props = defineProps<{ department: string; orderId: string }>()
const isPackaging = props.department === 'packaging'
const route = useRoute()
const router = useRouter()
const mainRef = ref<InstanceType<typeof ScrollRegion> | null>(null)
const listRef = ref<HTMLElement | null>(null)

type Row = {
  key: string; count: number | string | null; unit: string; title: string; badge?: string; status: string; tone: BagRowTone
  photoUrl: string | null; done: boolean; dimPhoto?: boolean; deletable?: boolean; photoAction?: boolean; uploading?: boolean
  open?: () => void; remove?: () => void; takePhoto?: () => void
}
type Summary = {
  customerIndex: string; customerName: string; metricLabel: string; metricValue: string | number; metricUnit?: string
  progressLabel: string; segments: SummarySegment[]; statusText: string; countText: string; complete: boolean
}

const logistics = isPackaging ? null : useLogisticsBags(() => props.orderId)
const packaging = isPackaging ? usePackagingBags(() => props.orderId) : null

// Packaging-only overlays and notices.
const packagingActive = () => route.name === 'packaging-order-bags' && route.params.orderId === props.orderId
const sheet = useQueryOverlay('bag', packagingActive)
const scan = useQueryOverlay('scan', packagingActive)
const photo = useQueryOverlay('photo', packagingActive)
const confirmOpen = ref(false)
const printNotice = ref<string | null>(null)
const scanResult = ref<ScanDisplay | null>(null)
let replacingLeave = false

const newBags = computed(() => packaging?.bags.value ?? [])
const sheetBag = computed(() => newBags.value.find(bag => bag.id === sheet.id.value) ?? null)
const sheetScannerOpen = computed(() => scan.id.value === '1' && sheetBag.value !== null)
const cameraOpen = computed(() => newBags.value.some(bag => bag.id === photo.id.value))
const sheetCards = computed(() => {
  const current = packaging?.order.value
  const bag = sheetBag.value
  if (!current || !bag) return []
  return current.garments
    .filter(garment => !garment.confirmedBagId)
    .map(garment => ({ garment, state: garmentState(current, newBags.value, bag.id, garment) }))
})
const emptyNames = computed(() => packaging ? packaging.emptyBags.value.map(bag => `Bag ${packaging.numberOf(bag.id)}`).join(', ') : '')

const loading = computed(() => (logistics ?? packaging)!.loading.value)
const error = computed(() => (logistics ?? packaging)!.error.value)

const summary = computed<Summary | null>(() => {
  if (logistics) {
    const bags = logistics.bags.value
    if (!bags.length && loading.value) return null
    const left = bags.length - logistics.scannedCount.value
    return {
      customerIndex: String(logistics.customer.value?.customerIndex ?? '—'),
      customerName: logistics.customer.value?.customerName ?? logistics.customerId.value,
      metricLabel: 'Total weight', metricValue: logistics.totalWeight.value, metricUnit: 'kg',
      progressLabel: 'Bags scanned',
      segments: bags.map(bag => bag.scanned ? 'done' : 'empty'),
      statusText: !bags.length ? 'No bag tickets yet' : logistics.complete.value ? 'All bags scanned · ready for delivery' : `${left} ${left === 1 ? 'bag' : 'bags'} left to scan`,
      countText: `${logistics.scannedCount.value} / ${bags.length}`,
      complete: logistics.complete.value,
    }
  }
  const order = packaging!.order.value
  if (!order) return null
  const total = order.garments.length
  const packed = packedCount(order)
  const pending = packaging!.pending.value
  const left = total - packed - pending
  const complete = total > 0 && packed === total
  return {
    customerIndex: order.customerIndex,
    customerName: order.customerName,
    metricLabel: 'Bags', metricValue: order.confirmedBags.length + newBags.value.length,
    progressLabel: 'Garments packed',
    segments: Array.from({ length: total }, (_, index) => index < packed ? 'done' : index < packed + pending ? 'pending' : 'empty'),
    statusText: !total ? 'No garments yet' : complete ? 'All garments packed' : `${left} ${left === 1 ? 'garment' : 'garments'} left to pack${pending ? ` · ${pending} in new ${newBags.value.length === 1 ? 'bag' : 'bags'}` : ''}`,
    countText: `${packed} / ${total}`,
    complete,
  }
})

const rows = computed<Row[]>(() => {
  if (logistics) {
    return logistics.bags.value.map(bag => ({
      key: bag.orderImageId, count: bag.weight, unit: 'kg', title: `Bag ${bag.orderImageId}`,
      status: bag.scanned ? 'Scanned' : 'Pending', tone: bag.scanned ? 'success' : 'muted',
      photoUrl: bag.ticket.photoEvidenceUrl, done: bag.scanned, dimPhoto: !bag.scanned,
    }))
  }
  const state = packaging!
  const order = state.order.value
  if (!order) return []
  const items = (count: number) => count === 1 ? 'item' : 'items'
  return [
    ...order.confirmedBags.map((bag, index): Row => {
      const count = confirmedItemCount(order, bag.id)
      return { key: bag.id, count, unit: items(count), title: `Bag ${index + 1}`, status: `Confirmed · ${formatConfirmedAt(bag.confirmedAt)}`,
        tone: 'success', photoUrl: bag.photoUrl, done: true }
    }),
    ...newBags.value.map((bag): Row => {
      const count = bag.garmentTagIds.length
      const [status, tone]: [string, BagRowTone] = !count ? ['Empty · delete or add garments', 'error']
        : !bag.photoUrl ? ['Add bag photo', 'warning'] : ['Ready to confirm', 'success']
      return { key: bag.id, count, unit: items(count), title: `Bag ${state.numberOf(bag.id)}`, badge: 'New', status, tone,
        photoUrl: bag.photoUrl, done: false, deletable: true, photoAction: true, uploading: state.uploading.value.has(bag.id),
        open: () => sheet.open(bag.id), remove: () => state.deleteBag(bag.id), takePhoto: () => photo.open(bag.id) }
    }),
  ]
})

const listTitle = isPackaging ? 'Bags' : 'Weight photos'
const listSubtitle = isPackaging ? 'Confirmed bags are locked' : 'Scan every bag before delivery'
const listCount = computed(() => {
  if (logistics) return `${logistics.scannedCount.value} of ${logistics.bags.value.length} scanned`
  const order = packaging!.order.value
  return order ? `${packedCount(order)} of ${order.garments.length} packed` : ''
})

function addBag(): void {
  if (!packaging) return
  printNotice.value = null
  packaging.addBag()
  void nextTick(() => listRef.value?.lastElementChild?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }))
}

function openSheetScanner(): void {
  scanResult.value = null
  primeFeedbackAudio()
  scan.open('1')
}

function handleSheetScan(value: string): void {
  const bag = sheetBag.value
  if (!packaging || !bag || !sheetScannerOpen.value) return
  const outcome = packaging.scan(bag.id, value)
  if (!outcome) return
  feedback(outcome.success ? 'success' : 'failure')
  scanResult.value = { title: outcome.tagId, message: outcome.message, tone: outcome.success ? 'success' : 'error' }
}

function handleCapture(file: File): void {
  const bagId = photo.id.value
  if (!packaging || !bagId || newBags.value.find(bag => bag.id === bagId)?.photoUrl) return
  void packaging.setPhoto(bagId, file)
  photo.close()
}

async function confirmBags(): Promise<void> {
  if (!packaging) return
  confirmOpen.value = false
  printNotice.value = await packaging.confirm()
  mainRef.value?.el?.scrollTo({ top: 0, behavior: 'smooth' })
}

function retry(): void {
  void (logistics ?? packaging)!.load()
}

if (packaging) {
  const state = packaging
  watch(() => props.orderId, () => {
    state.order.value = null
    printNotice.value = null
    confirmOpen.value = false
    void state.load()
  }, { immediate: true })

  watch(() => [state.loading.value, sheet.id.value, scan.id.value, photo.id.value, sheetBag.value, cameraOpen.value] as const, ([isLoading, bagId, scanning, photoId]) => {
    if (isLoading) return
    if (scanning && !sheetScannerOpen.value) scan.close()
    else if (bagId && !sheetBag.value) sheet.close()
    else if (photoId && !cameraOpen.value) photo.close()
  })

  watch(sheetScannerOpen, open => { if (!open) scanResult.value = null })

  onBeforeRouteUpdate(to => {
    if (to.params.orderId !== props.orderId && (state.submitting.value || state.uploading.value.size)) return false
  })

  onBeforeRouteLeave(to => {
    if (state.submitting.value || state.uploading.value.size) return false
    if (replacingLeave || (!sheet.id.value && !scan.id.value && !photo.id.value)) return
    replacingLeave = true
    void router.replace(to).finally(() => { replacingLeave = false })
    return false
  })
}
</script>

<template>
  <ScrollRegion ref="mainRef" as="main" class="bg-surface pb-32">
    <OrderBagSummary v-if="summary && !error" v-bind="summary" />
    <div v-else-if="loading && !error" class="mx-3 mt-4 h-[150px] animate-pulse rounded-[20px] bg-surface-container" aria-busy="true" />
    <section class="mx-3 mt-5">
      <header class="mb-2.5 flex items-center justify-between gap-3">
        <div class="border-l-4 border-lime pl-2.5">
          <h2 class="font-headline text-[17px] font-extrabold tracking-[-0.03em] text-primary">{{ listTitle }}</h2>
          <p class="mt-[3px] font-label text-[9px] font-bold uppercase leading-none tracking-[0.1em] text-on-surface-variant">{{ listSubtitle }}</p>
        </div>
        <p v-if="!loading && !error" class="shrink-0 font-label text-[10px] font-extrabold uppercase tracking-[0.04em] text-on-surface-variant">{{ listCount }}</p>
      </header>
      <template v-if="packaging && !error">
        <div v-if="printNotice" role="status" class="mb-2 flex items-start gap-2 rounded-[14px] bg-success-container px-3 py-2.5 text-on-success-container">
          <span class="material-symbols-outlined mt-px shrink-0" style="font-size: 18px" aria-hidden="true">print</span>
          <p class="min-w-0 flex-1 font-body text-[13px] font-semibold leading-snug"><span class="font-extrabold">{{ printNotice }}</span></p>
          <button type="button" class="shrink-0" aria-label="Dismiss" @click="printNotice = null">
            <span class="material-symbols-outlined" style="font-size: 18px" aria-hidden="true">close</span>
          </button>
        </div>
        <div v-if="packaging.notice.value" role="alert" class="mb-2 rounded-[14px] bg-error-container px-3 py-2.5 font-body text-[13px] font-semibold text-on-error-container">{{ packaging.notice.value }}</div>
        <div v-if="packaging.emptyBags.value.length" role="alert" class="mb-2 flex items-start gap-2 rounded-[14px] bg-warning-container px-3 py-2.5 text-on-warning-container">
          <span class="material-symbols-outlined mt-px shrink-0" style="font-size: 18px" aria-hidden="true">warning</span>
          <p class="min-w-0 flex-1 font-body text-[13px] font-semibold leading-snug"><span class="font-extrabold">{{ emptyNames }} {{ packaging.emptyBags.value.length === 1 ? 'is' : 'are' }} empty.</span> Delete {{ packaging.emptyBags.value.length === 1 ? 'it' : 'them' }} — an empty bag would print an extra tag.</p>
        </div>
        <div v-if="packaging.bagsWithoutPhoto.value.length" role="status" class="mb-2 flex items-start gap-2 rounded-[14px] bg-info-container px-3 py-2.5 text-on-info-container">
          <span class="material-symbols-outlined mt-px shrink-0" style="font-size: 18px" aria-hidden="true">photo_camera</span>
          <p class="min-w-0 flex-1 font-body text-[13px] font-semibold leading-snug">{{ packaging.bagsWithoutPhoto.value.length }} new {{ packaging.bagsWithoutPhoto.value.length === 1 ? 'bag needs' : 'bags need' }} a photo before you can confirm.</p>
        </div>
      </template>
      <div v-if="loading && !rows.length && !error" class="grid gap-2" aria-busy="true"><div v-for="row in 3" :key="row" class="h-[76px] animate-pulse rounded-[14px] bg-surface-container" /></div>
      <div v-else-if="error" class="rounded-[14px] bg-white p-4 text-sm text-error"><p role="alert">{{ error }}</p><button type="button" class="mt-2 rounded px-3 py-2 font-bold focus-visible:outline-2 focus-visible:outline-lime" @click="retry">Retry</button></div>
      <div v-else-if="!rows.length && logistics" class="flex flex-col items-center rounded-[14px] bg-white px-4 py-7 text-center shadow-[0_1px_0_rgba(7,63,56,0.05)]"><span class="grid h-14 w-14 -rotate-[7deg] place-items-center rounded-[18px] bg-secondary-container text-on-secondary-container"><span class="material-symbols-outlined text-[28px]" aria-hidden="true">inventory_2</span></span><p class="mt-3 font-body text-sm font-extrabold text-on-surface">No bag tickets yet</p><p class="mt-1 font-body text-[13px] text-on-surface-variant">Logistics bag tickets appear here to be scanned.</p></div>
      <ol v-if="rows.length && !error" ref="listRef" class="grid gap-2">
        <OrderBagRow
          v-for="row in rows"
          :key="row.key"
          :count="row.count"
          :unit="row.unit"
          :title="row.title"
          :badge="row.badge"
          :status="row.status"
          :tone="row.tone"
          :photo-url="row.photoUrl"
          :done="row.done"
          :dim-photo="row.dimPhoto"
          :deletable="row.deletable"
          :photo-action="row.photoAction"
          :uploading="row.uploading"
          @open="row.open?.()"
          @delete="row.remove?.()"
          @take-photo="row.takePhoto?.()"
        />
      </ol>
      <AddBagCard v-if="packaging && packaging.order.value && !error && packaging.unassigned.value > 0" :unassigned="packaging.unassigned.value" @add="addBag" />
    </section>
  </ScrollRegion>

  <template v-if="logistics">
    <StickerFab class="absolute bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-5 z-10" label="Scan" aria-label="Scan bag tag" :disabled="loading || !!error || !logistics.bags.value.length || logistics.submitting.value" @click="logistics.openScanner"><span class="material-symbols-outlined text-[36px]" aria-hidden="true">qr_code_scanner</span></StickerFab>
    <div v-if="logistics.notice.value && !logistics.scannerOpen.value" :role="logistics.notice.value.success ? 'status' : 'alert'" class="absolute bottom-[max(1.25rem,env(safe-area-inset-bottom))] left-4 right-24 z-20 rounded-xl px-3 py-3 font-body text-sm shadow-lg" :class="logistics.notice.value.success ? 'bg-success-container text-on-success-container' : 'bg-error-container text-on-error-container'">{{ logistics.notice.value.message }}</div>
    <QrScannerOverlay :open="logistics.scannerOpen.value" title="Scan bags" @close="logistics.closeScanner" @scan="logistics.handleScan">
      <template #result><p class="mb-2 font-label text-sm font-bold">{{ logistics.scannedCount.value }} of {{ logistics.bags.value.length }} scanned</p><p v-if="logistics.notice.value" :role="logistics.notice.value.success ? 'status' : 'alert'" class="rounded-xl px-3 py-3 font-body text-sm" :class="logistics.notice.value.success ? 'bg-success-container text-on-success-container' : 'bg-error-container text-on-error-container'">{{ logistics.notice.value.message }}</p><p v-if="logistics.submitting.value" role="status" class="mt-2 text-sm">Saving scans…</p><button type="button" class="mt-3 rounded-full bg-lime px-5 py-2 font-label text-sm font-bold text-primary focus-visible:outline-2 focus-visible:outline-lime disabled:opacity-40" :disabled="!logistics.scannedTicketIds.value.size || logistics.submitting.value || loading || !!error" @click="logistics.confirmScans">Confirm {{ logistics.scannedTicketIds.value.size }} bags</button></template>
    </QrScannerOverlay>
  </template>

  <template v-if="packaging">
    <StickerFab class="absolute bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-5 z-10" label="Confirm" aria-label="Confirm bags" :disabled="loading || !!error || !packaging.confirmable.value" @click="confirmOpen = true">
      <span class="material-symbols-outlined" style="font-size: 36px; font-variation-settings: 'wght' 600" aria-hidden="true">check</span>
    </StickerFab>
    <PackagingBagSheet
      :open="sheetBag !== null"
      :bag-number="sheetBag ? packaging.numberOf(sheetBag.id) : 0"
      :selected-count="sheetBag?.garmentTagIds.length ?? 0"
      :cards="sheetCards"
      :loading="packaging.ticketsLoading.value"
      @close="sheet.close"
      @toggle="tagId => sheetBag && packaging?.toggle(sheetBag.id, tagId)"
      @scan="openSheetScanner"
    />
    <ConfirmOverlay
      :open="confirmOpen"
      :title="`Confirm ${newBags.length} new ${newBags.length === 1 ? 'bag' : 'bags'}?`"
      :description="`${packaging.pending.value} ${packaging.pending.value === 1 ? 'garment goes' : 'garments go'} into ${newBags.length === 1 ? 'this bag' : 'these bags'}. The tags will print and the ${newBags.length === 1 ? 'bag is' : 'bags are'} locked.`"
      cancel-label="Cancel"
      confirm-label="Confirm"
      @close="confirmOpen = false"
      @confirm="confirmBags"
    >
      <p v-if="packaging.unassigned.value > 0" class="flex items-start gap-1.5 rounded-[10px] bg-info-container px-2.5 py-2 font-body text-xs font-semibold text-on-info-container">
        <span class="material-symbols-outlined" style="font-size: 16px" aria-hidden="true">info</span>
        <span>{{ packaging.unassigned.value }} {{ packaging.unassigned.value === 1 ? 'garment is' : 'garments are' }} not bagged yet. You can pack {{ packaging.unassigned.value === 1 ? 'it' : 'them' }} later.</span>
      </p>
    </ConfirmOverlay>
    <QrScannerOverlay :open="sheetScannerOpen" :title="`Bag ${sheetBag ? packaging.numberOf(sheetBag.id) : ''}`" @close="scan.close" @scan="handleSheetScan">
      <template #result>
        <p class="mb-2 font-label text-sm font-bold">{{ sheetBag?.garmentTagIds.length ?? 0 }} in this bag</p>
        <ScanResultCard v-if="scanResult" :result="scanResult" />
      </template>
    </QrScannerOverlay>
    <CameraOverlay :open="cameraOpen" @close="photo.close" @capture="handleCapture" />
  </template>
</template>
