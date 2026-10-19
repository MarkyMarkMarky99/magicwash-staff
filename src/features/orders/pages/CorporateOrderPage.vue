<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute } from 'vue-router'
import PhotoViewer from '@/shared/components/PhotoViewer.vue'
import ScrollRegion from '@/shared/components/ScrollRegion.vue'
import { useCloseRoute } from '@/shared/navigation/use-close-route'
import { useCustomerStore } from '@/data/customers/customer.store'
import { usePriceListStore } from '@/data/price-list/price-list.store'
import CorporateAddItemDialog from '@/features/orders/components/CorporateAddItemDialog.vue'
import CorporateCountSheet from '@/features/orders/components/CorporateCountSheet.vue'
import CorporateOrderHeader from '@/features/orders/components/CorporateOrderHeader.vue'
import DocumentScannerOverlay from '@/features/orders/components/DocumentScannerOverlay.vue'
import OrderFormSectionHeader from '@/features/orders/components/OrderFormSectionHeader.vue'
import SlipPhotoControls from '@/features/orders/components/SlipPhotoControls.vue'
import { useCorporateOrderDraft } from '@/features/orders/composables/useCorporateOrderDraft'
import { useSlipOverlayRoute } from '@/features/orders/composables/useSlipOverlayRoute'
import { corporateOrderItems } from '@/features/orders/utils/corporate-order-items'

defineOptions({ name: 'CorporateOrderPage' })

const SAVE_NOT_CONNECTED = 'Saving corporate orders is not connected yet'

const route = useRoute()
const { close: closeRoute } = useCloseRoute({ name: 'order-list' })
const customerStore = useCustomerStore()
const priceListStore = usePriceListStore()
const { customers, loading: customersLoading, loaded: customersLoaded, error: customersError } = storeToRefs(customerStore)
const { items: priceListRows, loading: priceListLoading, loaded: priceListLoaded, error: priceListError } = storeToRefs(priceListStore)

const customerId = computed(() => (typeof route.params.customerId === 'string' ? route.params.customerId.trim() : ''))
const { draft, countedCount, total, setListItems, setCounted, addLine, removeLine, addSlipPhoto, replaceSlipPhoto, removeSlipPhoto } = useCorporateOrderDraft(() => customerId.value)
const slip = useSlipOverlayRoute()

const customer = computed(() => customers.value.find((entry) => entry.customerId === customerId.value) ?? null)
const listItems = computed(() => corporateOrderItems(customer.value?.priceGroup, priceListRows.value))
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
const sheetLoading = computed(() => customerLoading.value || (customer.value !== null && !priceListLoaded.value && !priceListError.value))
const sheetError = computed(() => (customer.value !== null ? priceListError.value : null))
const emptyList = computed(() => customer.value !== null && !sheetLoading.value && !sheetError.value && listItems.value.length === 0)

const addDialogOpen = ref(false)
const saveNotice = ref<string | null>(null)
const viewerRevision = ref(0)
let remountingViewer = false

const scanOverlay = computed(() => {
  const overlay = slip.overlay.value
  if (overlay?.kind !== 'scan') return null
  if (overlay.retakeId !== null && !draft.slipPhotos.some((photo) => photo.id === overlay.retakeId)) return null
  return overlay
})
const viewedPhotoId = computed(() => {
  const overlay = slip.overlay.value
  return overlay?.kind === 'view' && draft.slipPhotos.some((photo) => photo.id === overlay.id) ? overlay.id : null
})
const viewerImages = computed(() => draft.slipPhotos.map((photo, index) => ({ id: photo.id, src: photo.url, alt: `Slip page ${index + 1}` })))

watch(listItems, setListItems, { immediate: true })

function openScanner(retakeId: string | null = null): void {
  slip.open({ kind: 'scan', retakeId })
}

function openViewer(id: string): void {
  slip.open({ kind: 'view', id })
}

function onCapture(file: File): void {
  const overlay = scanOverlay.value
  if (!overlay) return
  if (overlay.retakeId === null) {
    addSlipPhoto(file)
    slip.close()
    return
  }
  replaceSlipPhoto(overlay.retakeId, file)
  openViewer(overlay.retakeId)
}

function onScannerClose(): void {
  const retakeId = scanOverlay.value?.retakeId
  if (retakeId) openViewer(retakeId)
  else slip.close()
}

function removeViewedPhoto(id: string): void {
  const index = draft.slipPhotos.findIndex((photo) => photo.id === id)
  const neighbour = draft.slipPhotos[index + 1] ?? draft.slipPhotos[index - 1]
  // Remounting the viewer destroys the old PhotoSwipe, which emits close; that close is not the user's.
  remountingViewer = true
  removeSlipPhoto(id)
  viewerRevision.value += 1
  if (neighbour) openViewer(neighbour.id)
  else slip.close()
  void nextTick(() => { remountingViewer = false })
}

function onViewerClose(): void {
  if (!remountingViewer) slip.close()
}

function addItem(name: string, counted: number | null): void {
  addLine(name, counted)
  addDialogOpen.value = false
}

function save(): void {
  saveNotice.value = SAVE_NOT_CONNECTED
}

onMounted(() => {
  slip.clear()
  void customerStore.loadCustomers()
  void priceListStore.load()
})
</script>

<template>
  <div class="relative flex h-full w-full flex-col overflow-hidden bg-surface font-body text-on-surface">
    <ScrollRegion>
      <CorporateOrderHeader :customer-name="customer?.customerName ?? null" :customer-sub="customerSub" :loading="customerLoading" :problem="customerProblem" v-model:received-date="draft.receivedDate" v-model:due-date="draft.dueDate" @close="closeRoute" />

      <div class="relative z-[1] -mt-4 rounded-t-2xl bg-surface px-4 pb-7 pt-4">
        <div>
          <OrderFormSectionHeader title="Count sheet" :subtitle="`Slip order · ${countedCount} of ${draft.lines.length} counted`">
            <template #action>
              <SlipPhotoControls :photos="draft.slipPhotos" @scan="openScanner()" @view="openViewer(draft.slipPhotos[0]!.id)" />
            </template>
          </OrderFormSectionHeader>
          <CorporateCountSheet
            :lines="draft.lines"
            :total="total"
            :loading="sheetLoading"
            :error="sheetError"
            :empty-list="emptyList"
            @count="setCounted"
            @remove="removeLine"
            @add="addDialogOpen = true"
          />
        </div>
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
        <button type="button" class="h-[52px] flex-1 rounded-full bg-primary font-headline text-base font-bold text-on-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime" @click="save">Save order</button>
      </div>
    </footer>

    <CorporateAddItemDialog :open="addDialogOpen" @close="addDialogOpen = false" @add="addItem" />
    <DocumentScannerOverlay :open="scanOverlay !== null" @close="onScannerClose" @capture="onCapture" />
    <PhotoViewer :key="viewerRevision" :images="viewerImages" :active-id="viewedPhotoId" @change="openViewer" @close="onViewerClose">
      <template #footer="{ image, index }">
        <p class="font-label text-sm font-bold">Page {{ index + 1 }} of {{ viewerImages.length }}</p>
        <div class="flex gap-3">
          <button type="button" class="inline-flex h-12 items-center gap-1.5 rounded-full border border-white/35 px-6 text-sm font-semibold text-white" @click="openScanner(image.id)">
            <span class="material-symbols-outlined text-[20px]" aria-hidden="true">flip_camera_ios</span>Retake
          </button>
          <button type="button" class="inline-flex h-12 items-center gap-1.5 rounded-full bg-error px-6 text-sm font-bold text-on-error" @click="removeViewedPhoto(image.id)">
            <span class="material-symbols-outlined text-[20px]" aria-hidden="true">delete</span>Remove
          </button>
        </div>
      </template>
    </PhotoViewer>
  </div>
</template>
