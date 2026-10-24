<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { workOrderCreateSchema } from '@contracts/work-orders/work-order-api.schema'
import { currentActor } from '@/shared/config/actor'
import CameraOverlay from '@/shared/components/CameraOverlay.vue'
import PhotoViewer from '@/shared/components/PhotoViewer.vue'
import ScrollRegion from '@/shared/components/ScrollRegion.vue'
import WeightPrompt from '@/shared/components/WeightPrompt.vue'
import { useCloseRoute } from '@/shared/navigation/use-close-route'
import { primeFeedbackAudio } from '@/shared/utils/scan-feedback'
import { useCustomerStore } from '@/data/customers/customer.store'
import { createLaundryPhoto, uploadLaundryPhoto } from '@/data/laundry-photos/laundry-photo.service'
import DocumentScannerOverlay from '@/features/orders/components/DocumentScannerOverlay.vue'
import GarmentRegistrationCamera from '@/features/orders/components/GarmentRegistrationCamera.vue'
import OrderFormSectionHeader from '@/features/orders/components/OrderFormSectionHeader.vue'
import OrderIntakeCaptureMenu from '@/features/orders/components/OrderIntakeCaptureMenu.vue'
import OrderIntakeDetailsSheet from '@/features/orders/components/OrderIntakeDetailsSheet.vue'
import OrderIntakeHeader from '@/features/orders/components/OrderIntakeHeader.vue'
import OrderIntakeItemsPaper from '@/features/orders/components/OrderIntakeItemsPaper.vue'
import OrderIntakePhotosSheet from '@/features/orders/components/OrderIntakePhotosSheet.vue'
import OrderIntakePreviewStack from '@/features/orders/components/OrderIntakePreviewStack.vue'
import { useOrderIntakeDraft } from '@/features/orders/composables/useOrderIntakeDraft'
import { useOrderIntakeGarments } from '@/features/orders/composables/useOrderIntakeGarments'
import { useOrderIntakeOverlayRoute } from '@/features/orders/composables/useOrderIntakeOverlayRoute'
import { useOrderImageStore } from '@/features/orders/stores/order-image.store'
import { useOrderStore } from '@/features/orders/stores/order.store'
import {
  orderIntakeCategories,
  orderIntakeCreatePayload,
  orderIntakeServiceLabel,
  photosOf,
  type OrderIntakeCategory,
  type OrderIntakeDetails,
} from '@/features/orders/utils/order-intake-draft'

defineOptions({ name: 'OrderIntakePage' })

const route = useRoute()
const router = useRouter()
const orderStore = useOrderStore()
const orderImageStore = useOrderImageStore()
const customerStore = useCustomerStore()
const { close: closeRoute } = useCloseRoute({ name: 'order-list' })
const { customers, loaded: customersLoaded, error: customersError } = storeToRefs(customerStore)

const customerId = computed(() => (typeof route.params.customerId === 'string' ? route.params.customerId.trim() : ''))
const { draft, addPhoto, removePhoto } = useOrderIntakeDraft(() => customerId.value)
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
const saving = ref(false)
const savedOrderId = ref<string | null>(null)
const weightKg = ref<number | null>(null)
const viewerRevision = ref(0)
let remountingViewer = false

const details = computed<OrderIntakeDetails>(() => ({
  orderName: draft.orderName,
  note: draft.note,
  serviceType: draft.serviceType,
  receivedDate: draft.receivedDate,
  dueDate: draft.dueDate,
}))
const counts = computed(() => Object.fromEntries(
  orderIntakeCategories.map((category) => [category.key, photosOf(draft.photos, category.key).length]),
) as Record<OrderIntakeCategory, number>)
const sheetPhotos = computed(() => orderIntakeCategories.flatMap((category) => photosOf(draft.photos, category.key)))
const overlayKind = computed(() => intakeOverlay.overlay.value?.kind ?? null)
const viewedPhotoId = computed(() => {
  const overlay = intakeOverlay.overlay.value
  return overlay?.kind === 'view' && draft.photos.some((photo) => photo.id === overlay.id) ? overlay.id : null
})
const viewerImages = computed(() => sheetPhotos.value.map((photo, index) => ({
  id: photo.id,
  src: photo.previewUrl,
  alt: `${orderIntakeCategories.find((category) => category.key === photo.category)?.name ?? 'Photo'} photo ${index + 1}`,
})))
const weightPromptOpen = computed(() => overlayKind.value === 'weight' && weightKg.value === null)
const cameraOpen = computed(() => overlayKind.value === 'belonging' || (overlayKind.value === 'weight' && weightKg.value !== null))

const garments = useOrderIntakeGarments(
  () => new Set(photosOf(draft.photos, 'garments').flatMap((photo) => (photo.tag ? [photo.tag] : []))),
  (tag, file) => { addPhoto('garments', file, { tag }) },
)

watch(overlayKind, (kind) => {
  if (kind !== 'weight') weightKg.value = null
  if (kind !== 'garments') garments.reset()
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
  if (saving.value || savedOrderId.value) return
  if (category === 'garments') void primeFeedbackAudio()
  intakeOverlay.open({ kind: category })
}

function onDocumentCapture(file: File): void {
  addPhoto('document', file)
  intakeOverlay.close()
}

function onCameraCapture(file: File): void {
  if (overlayKind.value === 'weight') {
    if (weightKg.value === null) return
    addPhoto('weight', file, { weight: weightKg.value })
    weightKg.value = null
    intakeOverlay.close()
    return
  }
  addPhoto('belonging', file)
}

function openViewer(id: string): void {
  intakeOverlay.open({ kind: 'view', id })
}

function onViewerClose(): void {
  if (remountingViewer || overlayKind.value !== 'view') return
  intakeOverlay.open({ kind: 'photos' })
}

function removeViewedPhoto(id: string): void {
  // Remounting the viewer destroys the old PhotoSwipe, which emits close; that close is not the user's.
  remountingViewer = true
  removePhoto(id)
  viewerRevision.value += 1
  intakeOverlay.open({ kind: 'photos' })
  void nextTick(() => { remountingViewer = false })
}

async function save(): Promise<void> {
  if (saving.value || savedOrderId.value) return
  saveNotice.value = null
  saving.value = true
  try {
    const actor = currentActor()
    const payload = workOrderCreateSchema.parse(orderIntakeCreatePayload(draft, actor))
    const photos = [...draft.photos]
    const created = await orderStore.create(payload)
    savedOrderId.value = created.orderId
    let garmentsFailed = 0
    let photosFailed = 0
    for (const photo of photos.filter((entry) => entry.category === 'garments')) {
      try {
        const imageUrl = await uploadLaundryPhoto(photo.file)
        await createLaundryPhoto({ orderId: created.orderId, orderItemId: null, itemId: photo.tag, createdBy: actor, imageUrl })
      } catch {
        garmentsFailed += 1
      }
    }
    for (const photo of photos.filter((entry) => entry.category !== 'garments')) {
      const imageType = photo.category === 'document' ? 'DOCUMENT' : photo.category === 'weight' ? 'WEIGHT' : 'BELONGING'
      await orderImageStore.captureImage({ orderId: created.orderId, imageType, file: photo.file, quantity: photo.weight })
      if (orderImageStore.uploadError) photosFailed += 1
    }
    const failures = [
      garmentsFailed > 0 ? `${garmentsFailed} garment photo(s) could not be uploaded.` : null,
      photosFailed > 0 ? `${photosFailed} photo(s) could not be uploaded.` : null,
    ].filter(Boolean)
    if (failures.length > 0) {
      saveNotice.value = `Order ${created.orderId} created. ${failures.join(' ')}`
      return
    }
    await router.replace({ name: 'order-detail', params: { orderId: created.orderId } })
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : 'Unable to create work order'
    saveNotice.value = savedOrderId.value ? `Order ${savedOrderId.value} created. ${message}` : message
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  intakeOverlay.clear()
  void customerStore.loadCustomers()
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
          <OrderFormSectionHeader title="Items" subtitle="No items yet">
            <template #action>
              <OrderIntakePreviewStack :photos="draft.photos" @open="intakeOverlay.open({ kind: 'photos' })" />
              <OrderIntakeCaptureMenu :counts="counts" @select="openCapture" />
            </template>
          </OrderFormSectionHeader>
        </div>
        <OrderIntakeItemsPaper />
        <p class="mt-3.5 flex items-start gap-2.5 rounded-[14px] bg-info-container p-3 text-[12.5px] font-medium leading-[1.4] text-on-info-container">
          <span class="material-symbols-outlined flex-none text-[20px]" aria-hidden="true">auto_awesome</span>
          <span>After you save, AI sorts the garments into order items for you to check.</span>
        </p>
      </div>
    </ScrollRegion>

    <footer class="flex-none border-t border-outline-variant/70 bg-surface/95 px-4 pb-[max(14px,env(safe-area-inset-bottom))] pt-2.5 shadow-[0_-5px_18px_color-mix(in_srgb,var(--color-primary)_7%,transparent)]">
      <div v-if="saveNotice" role="status" class="mb-2.5 flex items-start gap-2 rounded-xl bg-warning-container px-3 py-2 text-sm text-on-warning-container">
        <span class="flex-1 font-semibold">{{ saveNotice }}</span>
        <button type="button" class="shrink-0 rounded p-0.5 focus-visible:outline-2 focus-visible:outline-lime" aria-label="Dismiss notice" @click="saveNotice = null">
          <span class="material-symbols-outlined text-[16px]" aria-hidden="true">close</span>
        </button>
      </div>
      <RouterLink v-if="savedOrderId && !saving" :to="{ name: 'order-detail', params: { orderId: savedOrderId } }" class="mb-2.5 block text-sm font-semibold text-primary underline">Open order {{ savedOrderId }}</RouterLink>
      <div class="flex gap-2.5">
        <button type="button" class="h-[52px] flex-1 rounded-full border-2 border-primary bg-white font-headline text-base font-bold text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime" :disabled="saving" @click="closeRoute">Discard</button>
        <button type="button" class="h-[52px] flex-1 rounded-full bg-primary font-headline text-base font-bold text-on-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime" :disabled="saving || savedOrderId !== null" @click="save">{{ saving ? 'Saving…' : 'Save order' }}</button>
      </div>
    </footer>

    <OrderIntakeDetailsSheet
      :open="detailsOpen"
      :customer-name="customer?.customerName ?? null"
      :customer-sub="customerSub"
      :details="details"
      @close="detailsOpen = false"
      @apply="applyDetails"
    />
    <OrderIntakePhotosSheet :open="overlayKind === 'photos'" :photos="draft.photos" @close="intakeOverlay.close" @view="openViewer" />
    <GarmentRegistrationCamera
      :open="overlayKind === 'garments'"
      :tag="garments.tag.value"
      :has-photo="garments.photo.value !== null"
      :registered-count="counts.garments"
      :pending-count="0"
      :tag-checking="false"
      :warning="garments.warning.value"
      :errors="[]"
      :load-error="null"
      item-label="garments (no item)"
      :reset-version="garments.resetVersion.value"
      @close="intakeOverlay.close"
      @tag="garments.acceptTag"
      @photo="garments.setPhoto"
      @redo-tag="garments.clearTag"
    />
    <DocumentScannerOverlay :open="overlayKind === 'document'" @close="intakeOverlay.close" @capture="onDocumentCapture" />
    <WeightPrompt :open="weightPromptOpen" input-id="order-intake-weight" title="Enter weight" description="Enter the weight for this one photo. One bag per photo." @submit="weightKg = $event" @close="intakeOverlay.close" />
    <CameraOverlay :open="cameraOpen" @close="intakeOverlay.close" @capture="onCameraCapture" />
    <PhotoViewer :key="viewerRevision" :images="viewerImages" :active-id="viewedPhotoId" @change="openViewer" @close="onViewerClose">
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
