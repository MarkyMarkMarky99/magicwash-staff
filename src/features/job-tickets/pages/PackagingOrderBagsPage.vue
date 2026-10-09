<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import AppLayout from '@/shared/layouts/AppLayout.vue'
import ConfirmOverlay from '@/shared/layouts/ConfirmOverlay.vue'
import CameraOverlay from '@/shared/components/CameraOverlay.vue'
import QrScannerOverlay from '@/shared/components/QrScannerOverlay.vue'
import ScrollRegion from '@/shared/components/ScrollRegion.vue'
import StickerFab from '@/shared/components/StickerFab.vue'
import { feedback, primeFeedbackAudio } from '@/shared/utils/scan-feedback'
import AddBagCard from '../components/AddBagCard.vue'
import ConfirmedBagRow from '../components/ConfirmedBagRow.vue'
import NewBagRow from '../components/NewBagRow.vue'
import PackagingBagSheet from '../components/PackagingBagSheet.vue'
import PackagingBagSummary from '../components/PackagingBagSummary.vue'
import ScanResultCard from '../components/ScanResultCard.vue'
import { usePackagingBags } from '../composables/usePackagingBags'
import { useQueryOverlay } from '../composables/useQueryOverlay'
import { confirmedItemCount, formatConfirmedAt, garmentState, packedCount } from '../packaging-bags'
import type { ScanDisplay } from '../scan-result'

const props = defineProps<{ orderId: string }>()
const route = useRoute()
const router = useRouter()
const state = usePackagingBags(() => props.orderId)
const { order, bags, loading, error } = state
const active = () => route.name === 'packaging-order-bags' && route.params.orderId === props.orderId
const sheet = useQueryOverlay('bag', active)
const scan = useQueryOverlay('scan', active)
const photo = useQueryOverlay('photo', active)
const confirmOpen = ref(false)
const printNotice = ref<number | null>(null)
const scanResult = ref<ScanDisplay | null>(null)
const mainRef = ref<InstanceType<typeof ScrollRegion> | null>(null)
const listRef = ref<HTMLElement | null>(null)
let replacingLeave = false

const sheetBag = computed(() => bags.value.find(bag => bag.id === sheet.id.value) ?? null)
const scannerOpen = computed(() => scan.id.value === '1' && sheetBag.value !== null)
const cameraOpen = computed(() => bags.value.some(bag => bag.id === photo.id.value))
const sheetCards = computed(() => {
  const current = order.value
  const bag = sheetBag.value
  if (!current || !bag) return []
  return current.garments
    .filter(garment => !garment.confirmedBagId)
    .map(garment => ({ garment, state: garmentState(current, bags.value, bag.id, garment) }))
})
const emptyNames = computed(() => state.emptyBags.value.map(bag => `Bag ${state.numberOf(bag.id)}`).join(', '))

function addBag(): void {
  printNotice.value = null
  state.addBag()
  void nextTick(() => listRef.value?.lastElementChild?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }))
}

function openScanner(): void {
  scanResult.value = null
  primeFeedbackAudio()
  scan.open('1')
}

function handleScan(value: string): void {
  const bag = sheetBag.value
  if (!bag || !scannerOpen.value) return
  const outcome = state.scan(bag.id, value)
  if (!outcome) return
  feedback(outcome.success ? 'success' : 'failure')
  scanResult.value = { title: outcome.tagId, message: outcome.message, tone: outcome.success ? 'success' : 'error' }
}

function handleCapture(file: File): void {
  const bagId = photo.id.value
  if (!bagId || bags.value.find(bag => bag.id === bagId)?.photoUrl) return
  state.setPhoto(bagId, file)
  photo.close()
}

function confirmBags(): void {
  confirmOpen.value = false
  printNotice.value = state.confirm()
  mainRef.value?.el?.scrollTo({ top: 0, behavior: 'smooth' })
}

watch(() => props.orderId, () => {
  order.value = null
  printNotice.value = null
  confirmOpen.value = false
  void state.load()
}, { immediate: true })

watch(() => [loading.value, sheet.id.value, scan.id.value, photo.id.value, sheetBag.value, cameraOpen.value] as const, ([isLoading, bagId, scanning, photoId]) => {
  if (isLoading) return
  if (scanning && !scannerOpen.value) scan.close()
  else if (bagId && !sheetBag.value) sheet.close()
  else if (photoId && !cameraOpen.value) photo.close()
})

watch(scannerOpen, open => { if (!open) scanResult.value = null })

onBeforeRouteLeave(to => {
  if (replacingLeave || (!sheet.id.value && !scan.id.value && !photo.id.value)) return
  replacingLeave = true
  void router.replace(to).finally(() => { replacingLeave = false })
  return false
})
</script>

<template>
  <AppLayout>
    <ScrollRegion ref="mainRef" as="main" class="bg-surface pb-32">
      <div v-if="loading && !order" class="mx-3 mt-4 grid gap-2" aria-busy="true">
        <div class="h-[210px] animate-pulse rounded-[20px] bg-surface-container" />
        <div v-for="row in 3" :key="row" class="h-[76px] animate-pulse rounded-[14px] bg-surface-container" />
      </div>
      <div v-else-if="error" class="mx-3 mt-4 rounded-[14px] bg-white p-4 text-sm text-error">
        <p role="alert">{{ error }}</p>
        <button type="button" class="mt-2 rounded px-3 py-2 font-bold focus-visible:outline-2 focus-visible:outline-lime" @click="state.load">Retry</button>
      </div>
      <template v-else-if="order">
        <PackagingBagSummary
          :customer-index="order.customerIndex"
          :customer-name="order.customerName"
          :order-id="order.orderId"
          :status-label="order.statusLabel"
          :total="order.garments.length"
          :packed="packedCount(order)"
          :pending="state.pending.value"
          :bag-count="order.confirmedBags.length + bags.length"
          :new-bag-count="bags.length"
        />
        <section class="mx-3 mt-5">
          <header class="mb-2.5 flex items-center justify-between gap-3">
            <div class="border-l-4 border-lime pl-2.5">
              <h2 class="font-headline text-[17px] font-extrabold tracking-[-0.03em] text-primary">Bags</h2>
              <p class="mt-[3px] font-label text-[9px] font-bold uppercase leading-none tracking-[0.1em] text-on-surface-variant">Confirmed bags are locked</p>
            </div>
          </header>
          <div v-if="printNotice" role="status" class="mb-2 flex items-start gap-2 rounded-[14px] bg-success-container px-3 py-2.5 text-on-success-container">
            <span class="material-symbols-outlined mt-px shrink-0" style="font-size: 18px" aria-hidden="true">print</span>
            <p class="min-w-0 flex-1 font-body text-[13px] font-semibold leading-snug"><span class="font-extrabold">{{ printNotice }} bag {{ printNotice === 1 ? 'tag is' : 'tags are' }} printing.</span> Stick each tag on its bag.</p>
            <button type="button" class="shrink-0" aria-label="Dismiss" @click="printNotice = null">
              <span class="material-symbols-outlined" style="font-size: 18px" aria-hidden="true">close</span>
            </button>
          </div>
          <div v-if="state.emptyBags.value.length" role="alert" class="mb-2 flex items-start gap-2 rounded-[14px] bg-warning-container px-3 py-2.5 text-on-warning-container">
            <span class="material-symbols-outlined mt-px shrink-0" style="font-size: 18px" aria-hidden="true">warning</span>
            <p class="min-w-0 flex-1 font-body text-[13px] font-semibold leading-snug"><span class="font-extrabold">{{ emptyNames }} {{ state.emptyBags.value.length === 1 ? 'is' : 'are' }} empty.</span> Delete {{ state.emptyBags.value.length === 1 ? 'it' : 'them' }} — an empty bag would print an extra tag.</p>
          </div>
          <div v-if="state.bagsWithoutPhoto.value.length" role="status" class="mb-2 flex items-start gap-2 rounded-[14px] bg-info-container px-3 py-2.5 text-on-info-container">
            <span class="material-symbols-outlined mt-px shrink-0" style="font-size: 18px" aria-hidden="true">photo_camera</span>
            <p class="min-w-0 flex-1 font-body text-[13px] font-semibold leading-snug">{{ state.bagsWithoutPhoto.value.length }} new {{ state.bagsWithoutPhoto.value.length === 1 ? 'bag needs' : 'bags need' }} a photo before you can confirm.</p>
          </div>
          <ol v-if="order.confirmedBags.length || bags.length" ref="listRef" class="grid gap-2">
            <ConfirmedBagRow
              v-for="(bag, index) in order.confirmedBags"
              :key="bag.id"
              :number="index + 1"
              :item-count="confirmedItemCount(order, bag.id)"
              :confirmed-at="formatConfirmedAt(bag.confirmedAt)"
              :photo-url="bag.photoUrl"
            />
            <NewBagRow
              v-for="bag in bags"
              :key="bag.id"
              :number="state.numberOf(bag.id)"
              :item-count="bag.garmentTagIds.length"
              :photo-url="bag.photoUrl"
              @open="sheet.open(bag.id)"
              @delete="state.deleteBag(bag.id)"
              @take-photo="photo.open(bag.id)"
            />
          </ol>
          <AddBagCard v-if="state.unassigned.value > 0" :unassigned="state.unassigned.value" @add="addBag" />
        </section>
      </template>
    </ScrollRegion>
    <StickerFab
      class="absolute bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-5 z-10"
      label="Confirm"
      aria-label="Confirm bags"
      :disabled="loading || !!error || !state.confirmable.value"
      @click="confirmOpen = true"
    >
      <span class="material-symbols-outlined" style="font-size: 36px; font-variation-settings: 'wght' 600" aria-hidden="true">check</span>
    </StickerFab>
    <PackagingBagSheet
      :open="sheetBag !== null"
      :bag-number="sheetBag ? state.numberOf(sheetBag.id) : 0"
      :selected-count="sheetBag?.garmentTagIds.length ?? 0"
      :cards="sheetCards"
      @close="sheet.close"
      @toggle="tagId => sheetBag && state.toggle(sheetBag.id, tagId)"
      @scan="openScanner"
    />
    <ConfirmOverlay
      :open="confirmOpen"
      :title="`Confirm ${bags.length} new ${bags.length === 1 ? 'bag' : 'bags'}?`"
      :description="`${state.pending.value} ${state.pending.value === 1 ? 'garment goes' : 'garments go'} into ${bags.length === 1 ? 'this bag' : 'these bags'}. The tags will print and the ${bags.length === 1 ? 'bag is' : 'bags are'} locked.`"
      cancel-label="Cancel"
      confirm-label="Confirm"
      @close="confirmOpen = false"
      @confirm="confirmBags"
    >
      <p v-if="state.unassigned.value > 0" class="flex items-start gap-1.5 rounded-[10px] bg-info-container px-2.5 py-2 font-body text-xs font-semibold text-on-info-container">
        <span class="material-symbols-outlined" style="font-size: 16px" aria-hidden="true">info</span>
        <span>{{ state.unassigned.value }} {{ state.unassigned.value === 1 ? 'garment is' : 'garments are' }} not bagged yet. You can pack {{ state.unassigned.value === 1 ? 'it' : 'them' }} later.</span>
      </p>
    </ConfirmOverlay>
    <QrScannerOverlay :open="scannerOpen" :title="`Bag ${sheetBag ? state.numberOf(sheetBag.id) : ''}`" @close="scan.close" @scan="handleScan">
      <template #result>
        <p class="mb-2 font-label text-sm font-bold">{{ sheetBag?.garmentTagIds.length ?? 0 }} in this bag</p>
        <ScanResultCard v-if="scanResult" :result="scanResult" />
      </template>
    </QrScannerOverlay>
    <CameraOverlay :open="cameraOpen" @close="photo.close" @capture="handleCapture" />
  </AppLayout>
</template>
