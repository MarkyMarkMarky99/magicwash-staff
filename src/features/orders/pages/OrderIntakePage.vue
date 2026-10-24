<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute } from 'vue-router'
import CameraOverlay from '@/shared/components/CameraOverlay.vue'
import PhotoViewer from '@/shared/components/PhotoViewer.vue'
import QrScannerOverlay from '@/shared/components/QrScannerOverlay.vue'
import ScrollRegion from '@/shared/components/ScrollRegion.vue'
import AppHeader from '@/shared/components/AppHeader.vue'
import PickerOverlay from '@/shared/layouts/PickerOverlay.vue'
import LaundryItemDetailView from '@/features/laundry-items/components/LaundryItemDetailView.vue'
import WeightPrompt from '@/shared/components/WeightPrompt.vue'
import { useScannerGunInput } from '@/shared/composables/useScannerGunInput'
import { useCloseRoute } from '@/shared/navigation/use-close-route'
import { primeFeedbackAudio } from '@/shared/utils/scan-feedback'
import { useCustomerStore } from '@/data/customers/customer.store'
import { useItemsStore } from '@/data/items/items.store'
import type { ItemDto } from '@/data/items/items.service'
import PriceListItemPicker from '@/features/price-list/components/PriceListItemPicker.vue'
import DocumentScannerOverlay from '@/features/orders/components/DocumentScannerOverlay.vue'
import SectionHeader from '@/shared/components/SectionHeader.vue'
import OrderIntakeCaptureMenu from '@/features/orders/components/OrderIntakeCaptureMenu.vue'
import OrderIntakeDetailsSheet from '@/features/orders/components/OrderIntakeDetailsSheet.vue'
import OrderIntakeHeader from '@/features/orders/components/OrderIntakeHeader.vue'
import OrderIntakeItemsPaper from '@/features/orders/components/OrderIntakeItemsPaper.vue'
import OrderIntakePhotosSheet from '@/features/orders/components/OrderIntakePhotosSheet.vue'
import OrderIntakePreviewStack from '@/features/orders/components/OrderIntakePreviewStack.vue'
import OrderIntakeScanBanner from '@/features/orders/components/OrderIntakeScanBanner.vue'
import OrderIntakeScanCard from '@/features/orders/components/OrderIntakeScanCard.vue'
import OrderIntakeRowSheet from '@/features/orders/components/OrderIntakeRowSheet.vue'
import { useOrderIntakeDraft } from '@/features/orders/composables/useOrderIntakeDraft'
import { useOrderIntakeOverlayRoute } from '@/features/orders/composables/useOrderIntakeOverlayRoute'
import { useOrderIntakeScan } from '@/features/orders/composables/useOrderIntakeScan'
import {
  allIntakePhotos,
  orderIntakeCategories,
  orderIntakePhotoCategories,
  orderIntakeSaveBody,
  orderIntakeServiceLabel,
  photosOf,
  type OrderIntakeCategory,
  type OrderIntakeDetails,
} from '@/features/orders/utils/order-intake-draft'
import { groupOrderIntakeGarments, type OrderIntakeRow } from '@/features/orders/utils/order-intake-items'

defineOptions({ name: 'OrderIntakePage' })

const route = useRoute()
const customerStore = useCustomerStore()
const itemsStore = useItemsStore()
const { close: closeRoute } = useCloseRoute({ name: 'order-list' })
const { customers, loaded: customersLoaded, error: customersError } = storeToRefs(customerStore)

const customerId = computed(() => (typeof route.params.customerId === 'string' ? route.params.customerId.trim() : ''))
const { draft, addGarment, setGarmentItem, addPhoto, removePhoto } = useOrderIntakeDraft(() => customerId.value)
const intakeOverlay = useOrderIntakeOverlayRoute()

const customer = computed(() => customers.value.find((entry) => entry.customerId === customerId.value) ?? null)
const customerSub = computed(() => {
  if (!customer.value) return null
  return [customer.value.customerIndex, customer.value.customerType].filter(Boolean).join(' · ')
})
const customerLoading = computed(() => customer.value === null && !customersLoaded.value && !customersError.value)
const customerProblem = computed(() => {
  if (customer.value) return null
  if (customersError.value) return 'Unable to load the customer'
  return customersLoaded.value ? 'Customer not found' : null
})

const detailsOpen = ref(false)
const saveNotice = ref<string | null>(null)
const weightKg = ref<number | null>(null)
// True while the defect camera was opened from the scan banner: closing it returns to the page, not the row sheet.
const shownRow = ref<OrderIntakeRow | null>(null)
const viewerRevision = ref(0)
let remountingViewer = false

const details = computed<OrderIntakeDetails>(() => ({
  orderName: draft.orderName,
  note: draft.note,
  serviceType: draft.serviceType,
  receivedDate: draft.receivedDate,
  dueDate: draft.dueDate,
}))
const grouped = computed(() => groupOrderIntakeGarments(draft.garments, itemsStore.items))
const hasUncategorized = computed(() => grouped.value.rows.some((row) => row.uncategorized))
const canSave = computed(() => draft.garments.length > 0 && !hasUncategorized.value)
const itemsSubtitle = computed(() => {
  const count = draft.garments.length
  if (count === 0) return 'No garments yet'
  return `${count} ${count === 1 ? 'garment' : 'garments'}`
})
const allPhotos = computed(() => allIntakePhotos(draft))
const counts = computed(() => Object.fromEntries(
  orderIntakeCategories.map((category) => [
    category.key,
    category.key === 'garments' ? draft.garments.length : photosOf(draft.photos, category.key).length,
  ]),
) as Record<OrderIntakeCategory, number>)
const sheetPhotos = computed(() => orderIntakePhotoCategories.flatMap((category) => photosOf(allPhotos.value, category.key)))
const overlay = computed(() => intakeOverlay.overlay.value)
const overlayKind = computed(() => overlay.value?.kind ?? null)
const rowOverlayKey = computed(() => (overlay.value?.kind === 'row' ? overlay.value.key : null))
const detailTag = computed(() => overlay.value?.kind === 'item' ? overlay.value.tag : null)
const returnedRowTag = ref<string | null>(null)
const openRowEntry = computed(() => {
  if (rowOverlayKey.value === null) return null
  return grouped.value.rows.find(row => row.key === rowOverlayKey.value)
    ?? grouped.value.rows.find(row => row.garments.some(garment => garment.tag === returnedRowTag.value)) ?? null
})
const viewedPhoto = computed(() => {
  const current = overlay.value
  return current?.kind === 'view' ? allPhotos.value.find((photo) => photo.id === current.id) ?? null : null
})
const viewerImages = computed(() => sheetPhotos.value.map((photo, index) => ({
  id: photo.id,
  src: photo.previewUrl,
  alt: `${orderIntakePhotoCategories.find((category) => category.key === photo.category)?.name ?? 'Photo'} photo ${index + 1}`,
})))
const weightPromptOpen = computed(() => overlayKind.value === 'weight' && weightKg.value === null)
const cameraOpen = computed(() => overlayKind.value === 'belonging' || overlayKind.value === 'defect' || (overlayKind.value === 'weight' && weightKg.value !== null))
const gunEnabled = computed(() => overlayKind.value === null && !detailsOpen.value)

const scan = useOrderIntakeScan(
  () => customerId.value,
  (tag) => draft.garments.some((garment) => garment.tag === tag),
  addGarment,
)
const bannerGarment = computed(() => {
  const banner = scan.banner.value
  if (!banner || banner.tone === 'error') return null
  return draft.garments.find((garment) => garment.tag === banner.tag) ?? null
})
const bannerItemName = computed(() => {
  const garment = bannerGarment.value
  if (!garment) return null
  const row = grouped.value.rows.find((entry) => entry.garments.some((member) => member.tag === garment.tag))
  return row && !row.uncategorized ? row.name : null
})

useScannerGunInput((code) => { void scan.scan(code) }, gunEnabled, { staffCards: 'skip' })

watch(overlayKind, (kind) => {
  if (kind !== 'weight') weightKg.value = null
})

watch(scan.banner, (banner) => { if (banner) saveNotice.value = null })

// A banner for a garment that is in the draft goes when that garment is removed.
watch(() => draft.garments.length, () => {
  const banner = scan.banner.value
  if (banner && banner.tone !== 'error' && bannerGarment.value === null) scan.dismissBanner()
})


watch(openRowEntry, (entry) => { if (entry) shownRow.value = entry }, { immediate: true })

watch(grouped, () => {
  if (rowOverlayKey.value !== null && openRowEntry.value === null) intakeOverlay.close()
})

function applyDetails(next: OrderIntakeDetails): void {
  draft.orderName = next.orderName
  draft.note = next.note
  draft.serviceType = next.serviceType
  draft.receivedDate = next.receivedDate
  draft.dueDate = next.dueDate
  detailsOpen.value = false
}

function openCapture(category: OrderIntakeCategory): void {
  if (category === 'garments') void primeFeedbackAudio()
  intakeOverlay.open({ kind: category })
}

function onDocumentCapture(file: File): void {
  addPhoto('document', file)
  intakeOverlay.close()
}

function onCameraCapture(file: File): void {
  const current = overlay.value
  if (current?.kind === 'defect') {
    addPhoto('defect', file, { tag: current.tag })
    return
  }
  if (current?.kind === 'weight') {
    if (weightKg.value === null) return
    addPhoto('weight', file, { weight: weightKg.value })
    weightKg.value = null
    intakeOverlay.close()
    return
  }
  addPhoto('belonging', file)
}

function openRow(key: string): void {
  returnedRowTag.value = null
  intakeOverlay.open({ kind: 'row', key })
}

function openGarment(tag: string): void {
  returnedRowTag.value = tag
  intakeOverlay.open({ kind: 'item', tag })
}

function updateDetailType(itemId: string): void {
  if (detailTag.value) setGarmentItem(detailTag.value, itemId)
}

function returnFromPicker(): void {
  intakeOverlay.close()
}

function selectItemType(item: ItemDto): void {
  const current = overlay.value
  if (current?.kind === 'pick') setGarmentItem(current.tag, item.id)
  returnFromPicker()
}

function openDefectFromBanner(): void {
  const garment = bannerGarment.value
  if (!garment) return
  intakeOverlay.open({ kind: 'defect', tag: garment.tag })
}

function changeTypeFromBanner(): void {
  const garment = bannerGarment.value
  if (garment) intakeOverlay.open({ kind: 'pick', tag: garment.tag })
}

function openViewer(id: string): void {
  intakeOverlay.open({ kind: 'view', id })
}

function leaveViewer(): void {
  intakeOverlay.open({ kind: 'photos' })
}

function onViewerClose(): void {
  if (remountingViewer || overlayKind.value !== 'view') return
  leaveViewer()
}

function removeViewedPhoto(id: string): void {
  // Remounting the viewer destroys the old PhotoSwipe, which emits close; that close is not the user's.
  remountingViewer = true
  removePhoto(id)
  viewerRevision.value += 1
  leaveViewer()
  void nextTick(() => { remountingViewer = false })
}

function onCameraClose(): void {
  intakeOverlay.close()
}

function save(): void {
  if (!canSave.value) return
  console.info('Order intake save request', orderIntakeSaveBody(draft, grouped.value.rows))
  saveNotice.value = 'Backend not connected yet — nothing was saved.'
}

onMounted(() => {
  if (overlayKind.value !== 'item') intakeOverlay.clear()
  void customerStore.loadCustomers()
  void itemsStore.load()
  scan.preload()
})
</script>

<template>
  <div class="relative flex h-full w-full flex-col overflow-hidden bg-surface font-body text-on-surface">
    <ScrollRegion>
      <OrderIntakeHeader
        :customer-name="customer?.customerName ?? null"
        :customer-sub="customerSub"
        :loading="customerLoading"
        :problem="customerProblem"
        :order-name="draft.orderName"
        :note="draft.note"
        :service-label="orderIntakeServiceLabel(draft.serviceType)"
        :received-date="draft.receivedDate"
        :due-date="draft.dueDate"
        @close="closeRoute"
        @edit="detailsOpen = true"
      />

      <div class="relative z-[1] -mt-4 rounded-t-2xl bg-surface px-4 pb-7 pt-4">
        <!-- Its own layer so the capture menu opens over the Items paper below it. -->
        <div class="relative z-[2]">
          <SectionHeader title="Items" :subtitle="itemsSubtitle">
            <template #action>
              <OrderIntakePreviewStack :photos="allPhotos" @open="intakeOverlay.open({ kind: 'photos' })" />
              <OrderIntakeCaptureMenu :counts="counts" @select="openCapture" />
            </template>
          </SectionHeader>
        </div>
        <OrderIntakeItemsPaper :rows="grouped.rows" :total="grouped.total" @select="openRow" />
      </div>
    </ScrollRegion>

    <footer class="flex-none border-t border-outline-variant/70 bg-surface/95 px-4 pb-[max(14px,env(safe-area-inset-bottom))] pt-2.5 shadow-[0_-5px_18px_color-mix(in_srgb,var(--color-primary)_7%,transparent)]">
      <div v-if="saveNotice" role="status" class="mb-2.5 flex items-start gap-2 rounded-xl bg-warning-container px-3 py-2 text-sm text-on-warning-container">
        <span class="flex-1 font-semibold">{{ saveNotice }}</span>
        <button type="button" class="shrink-0 rounded p-0.5 focus-visible:outline-2 focus-visible:outline-lime" aria-label="Dismiss notice" @click="saveNotice = null">
          <span class="material-symbols-outlined text-[16px]" aria-hidden="true">close</span>
        </button>
      </div>
      <div class="flex gap-2.5">
        <button type="button" class="h-[52px] flex-1 rounded-full border-2 border-primary bg-white font-headline text-base font-bold text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime" @click="closeRoute">Discard</button>
        <button type="button" class="h-[52px] flex-1 rounded-full bg-primary font-headline text-base font-bold text-on-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime disabled:opacity-50" :disabled="!canSave" @click="save">Save order</button>
      </div>
    </footer>

    <OrderIntakeScanCard
      v-if="scan.banner.value && overlayKind === null && !detailsOpen"
      :key="scan.bannerSeq.value"
      :banner="scan.banner.value"
      :garment="bannerGarment"
      :item-name="bannerItemName"
      @dismiss="scan.dismissBanner"
      @defect="openDefectFromBanner"
      @change-type="changeTypeFromBanner"
    />
    <OrderIntakeDetailsSheet
      :open="detailsOpen"
      :customer-name="customer?.customerName ?? null"
      :customer-sub="customerSub"
      :details="details"
      @close="detailsOpen = false"
      @apply="applyDetails"
    />
    <OrderIntakePhotosSheet :open="overlayKind === 'photos'" :photos="allPhotos" @close="intakeOverlay.close" @view="openViewer" />
    <OrderIntakeRowSheet
      :open="openRowEntry !== null"
      :title="shownRow?.name ?? ''"
      :garments="shownRow?.garments ?? []"
      @close="intakeOverlay.close"
      @open-item="openGarment"
    />
    <PickerOverlay :open="detailTag !== null" size="full" :draggable="false" ariaLabel="Garment detail" :close-button="false" @close="intakeOverlay.close">
      <template #header><AppHeader :back-action="intakeOverlay.close" /></template>
      <LaundryItemDetailView v-if="detailTag" :key="detailTag" :tag-id="detailTag" @type-changed="updateDetailType" />
    </PickerOverlay>
    <PriceListItemPicker
      selection-mode="item"
      :open="overlayKind === 'pick'"
      :detail="customer?.customerName ?? ''"
      :items="itemsStore.items"
      :loading="itemsStore.loading"
      :error="itemsStore.error"
      :truncated="itemsStore.truncated"
      @close="returnFromPicker"
      @retry="itemsStore.load"
      @select="selectItemType"
    />
    <QrScannerOverlay :open="overlayKind === 'garments'" title="Scan garment tags" @close="intakeOverlay.close" @scan="scan.scan">
      <template #result>
        <p class="font-label text-sm font-bold">{{ draft.garments.length }} in this order</p>
        <OrderIntakeScanBanner
          v-if="scan.banner.value"
          :key="scan.bannerSeq.value"
          class="mt-2"
          :banner="scan.banner.value"
          :garment="bannerGarment"
          :item-name="bannerItemName"
          :actions="false"
          @dismiss="scan.dismissBanner"
        />
      </template>
    </QrScannerOverlay>
    <DocumentScannerOverlay :open="overlayKind === 'document'" @close="intakeOverlay.close" @capture="onDocumentCapture" />
    <WeightPrompt :open="weightPromptOpen" input-id="order-intake-weight" title="Enter weight" description="Enter the weight for this one photo. One bag per photo." @submit="weightKg = $event" @close="intakeOverlay.close" />
    <CameraOverlay :open="cameraOpen" @close="onCameraClose" @capture="onCameraCapture" />
    <PhotoViewer :key="viewerRevision" :images="viewerImages" :active-id="viewedPhoto?.id ?? null" @change="openViewer" @close="onViewerClose">
      <template #footer="{ image }">
        <div class="flex gap-3">
          <button type="button" class="inline-flex h-12 items-center gap-1.5 rounded-full bg-error px-6 text-sm font-bold text-on-error" @click="removeViewedPhoto(image.id)">
            <span class="material-symbols-outlined text-[20px]" aria-hidden="true">delete</span>Remove
          </button>
        </div>
      </template>
    </PhotoViewer>
  </div>
</template>
