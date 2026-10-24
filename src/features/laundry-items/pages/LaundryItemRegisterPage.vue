<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { onBeforeRouteLeave, useRoute } from 'vue-router'
import { laundryItemRegisterRequestSchema } from '@contracts/laundry-items/laundry-item-register-api.schema'
import GarmentRegistrationCamera from '@/shared/components/GarmentRegistrationCamera.vue'
import PhotoViewer from '@/shared/components/PhotoViewer.vue'
import ScrollRegion from '@/shared/components/ScrollRegion.vue'
import StickerFab from '@/shared/components/StickerFab.vue'
import { useGarmentPhotoUploads } from '@/shared/composables/useGarmentPhotoUploads'
import { useCloseRoute } from '@/shared/navigation/use-close-route'
import { primeFeedbackAudio } from '@/shared/utils/scan-feedback'
import { ApiError } from '@/shared/api/api-client'
import { registerLaundryItems } from '@/data/laundry-items/laundry-item.service'
import { useCustomerStore } from '@/data/customers/customer.store'
import LaundryItemRegisterHeader from '@/features/laundry-items/components/LaundryItemRegisterHeader.vue'
import LaundryItemRegisterPaper from '@/features/laundry-items/components/LaundryItemRegisterPaper.vue'
import LaundryItemSectionHeader from '@/features/laundry-items/components/LaundryItemSectionHeader.vue'
import { useLaundryItemRegisterDraft } from '@/features/laundry-items/composables/useLaundryItemRegisterDraft'
import { useLaundryItemRegisterGarments } from '@/features/laundry-items/composables/useLaundryItemRegisterGarments'
import { useLaundryItemRegisterOverlayRoute } from '@/features/laundry-items/composables/useLaundryItemRegisterOverlayRoute'

defineOptions({ name: 'LaundryItemRegisterPage' })

const route = useRoute()
const customerStore = useCustomerStore()
const { customers, loaded: customersLoaded, error: customersError } = storeToRefs(customerStore)

const customerId = computed(() => (typeof route.params.customerId === 'string' ? route.params.customerId.trim() : ''))
const { close: closeRoute } = useCloseRoute({ name: 'customer-detail', params: { customerId: customerId.value } })
const { garments, addGarment, removeGarment } = useLaundryItemRegisterDraft()
const photoUploads = useGarmentPhotoUploads()
const overlayRoute = useLaundryItemRegisterOverlayRoute()

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

const saving = ref(false)
const saveNotice = ref<string | null>(null)
const viewerRevision = ref(0)
let remountingViewer = false
let kept = false

onBeforeRouteLeave(() => !saving.value || kept)

const overlayKind = computed(() => overlayRoute.overlay.value?.kind ?? null)
const viewedId = computed(() => {
  const overlay = overlayRoute.overlay.value
  return overlay?.kind === 'view' && garments.some((garment) => garment.id === overlay.id) ? overlay.id : null
})
const rows = computed(() => garments.map((garment) => ({
  id: garment.id,
  tag: garment.tag,
  previewUrl: garment.previewUrl,
  status: photoUploads.uploads[garment.id]?.status ?? 'uploading',
})))
const viewerImages = computed(() => garments.map((garment) => ({ id: garment.id, src: garment.previewUrl, alt: `Garment ${garment.tag}` })))
const subtitle = computed(() => (garments.length === 0 ? 'No garments yet' : `${garments.length} garments`))
const canSave = computed(() => !saving.value && garments.length > 0
  && rows.value.every((row) => row.status === 'done'))

const registerGarments = useLaundryItemRegisterGarments(
  () => customerId.value,
  () => new Set(garments.map((garment) => garment.tag)),
  (tag, file) => { photoUploads.start(addGarment(tag, file), file) },
)

watch(overlayKind, (kind) => {
  if (kind !== 'camera') registerGarments.reset()
})

function openCamera(): void {
  if (saving.value) return
  void primeFeedbackAudio()
  overlayRoute.open({ kind: 'camera' })
}

function openViewer(id: string): void {
  overlayRoute.open({ kind: 'view', id })
}

function onViewerClose(): void {
  if (remountingViewer || overlayRoute.overlay.value?.kind !== 'view') return
  overlayRoute.close()
}

function removeRow(id: string): void {
  if (saving.value) return
  removeGarment(id)
  if (!kept) photoUploads.remove(id)
}

function removeViewed(id: string): void {
  // Remounting the viewer destroys the old PhotoSwipe, which emits close; that close is not the user's.
  remountingViewer = true
  removeRow(id)
  viewerRevision.value += 1
  overlayRoute.close()
  void nextTick(() => { remountingViewer = false })
}

function discard(): void {
  if (saving.value) return
  if (!kept) photoUploads.discardAll()
  closeRoute()
}

async function save(): Promise<void> {
  if (!canSave.value) return
  saveNotice.value = null
  saving.value = true
  try {
    const payload = laundryItemRegisterRequestSchema.parse({
      customerId: customerId.value,
      garments: garments.map((garment) => ({
        tag: garment.tag,
        imageUrl: photoUploads.uploads[garment.id]?.url,
        itemId: null,
      })),
    })
    const result = await registerLaundryItems(payload)
    kept = true
    saveNotice.value = `${result.registered.length} registered`
      + (result.alreadyRegistered.length > 0 ? `, ${result.alreadyRegistered.length} already registered` : '')
      + (result.failed.length > 0 ? `, ${result.failed.length} photo rows failed` : '')
    if (result.failed.length === 0) closeRoute()
  } catch (reason) {
    if (reason instanceof ApiError && reason.status === 409 && reason.code === 'TAG_CONFLICT') {
      saveNotice.value = reason.message
    } else {
      saveNotice.value = reason instanceof Error ? reason.message : 'Unable to register garments'
    }
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  overlayRoute.clear()
  void customerStore.loadCustomers()
})

onBeforeUnmount(() => {
  if (!kept) photoUploads.discardAll()
})
</script>

<template>
  <div class="relative flex h-full w-full flex-col overflow-hidden bg-surface font-body text-on-surface">
    <ScrollRegion>
      <LaundryItemRegisterHeader
        :customer-name="customer?.customerName ?? null"
        :customer-sub="customerSub"
        :loading="customerLoading"
        :problem="customerProblem"
        @close="discard"
      />

      <div class="relative z-[1] -mt-4 rounded-t-2xl bg-surface px-4 pb-7 pt-4">
        <LaundryItemSectionHeader title="Items" :subtitle="subtitle">
          <template #action>
            <StickerFab
              class="!h-[46px] !w-[46px] !rounded-[17px_20px_17px_19px] [&_.sticker-label]:hidden"
              label="Take photo"
              aria-label="Take photo"
              :disabled="saving"
              @click="openCamera"
            >
              <span class="material-symbols-outlined text-[24px]" aria-hidden="true">photo_camera</span>
            </StickerFab>
          </template>
        </LaundryItemSectionHeader>
        <LaundryItemRegisterPaper :rows="rows" @view="openViewer" @remove="removeRow" @retry="photoUploads.retry" />
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
        <button type="button" class="h-[52px] flex-1 rounded-full border-2 border-primary bg-white font-headline text-base font-bold text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime" @click="discard">Discard</button>
        <button type="button" class="h-[52px] flex-1 rounded-full bg-primary font-headline text-base font-bold text-on-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime disabled:opacity-50" :disabled="!canSave" @click="save">{{ saving ? 'Saving…' : 'Save' }}</button>
      </div>
    </footer>

    <GarmentRegistrationCamera
      :open="overlayKind === 'camera'"
      :tag="registerGarments.tag.value"
      :has-photo="registerGarments.photo.value !== null"
      :registered-count="garments.length"
      :pending-count="0"
      :tag-checking="registerGarments.tagChecking.value"
      :warning="registerGarments.warning.value"
      :errors="[]"
      :load-error="null"
      item-label="garments (no item)"
      :reset-version="registerGarments.resetVersion.value"
      @close="overlayRoute.close"
      @tag="registerGarments.acceptTag"
      @photo="registerGarments.setPhoto"
      @redo-tag="registerGarments.clearTag"
    />
    <PhotoViewer :key="viewerRevision" :images="viewerImages" :active-id="viewedId" @change="openViewer" @close="onViewerClose">
      <template #footer="{ image }">
        <div class="flex gap-3">
          <button type="button" class="inline-flex h-12 items-center gap-1.5 rounded-full bg-error px-6 text-sm font-bold text-on-error" @click="removeViewed(image.id)">
            <span class="material-symbols-outlined text-[20px]" aria-hidden="true">delete</span>Remove
          </button>
        </div>
      </template>
    </PhotoViewer>
  </div>
</template>
