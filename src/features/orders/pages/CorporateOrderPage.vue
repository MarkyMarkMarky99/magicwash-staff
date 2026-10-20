<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { workOrderCreateSchema } from '@contracts/work-orders/work-order-api.schema'
import { currentActor } from '@/shared/config/actor'
import PhotoViewer from '@/shared/components/PhotoViewer.vue'
import ConfirmOverlay from '@/shared/layouts/ConfirmOverlay.vue'
import ScrollRegion from '@/shared/components/ScrollRegion.vue'
import { useCloseRoute } from '@/shared/navigation/use-close-route'
import { useCustomerStore } from '@/data/customers/customer.store'
import { usePriceListStore } from '@/data/price-list/price-list.store'
import { useItemsStore } from '@/data/items/items.store'
import CorporateAddItemDialog from '@/features/orders/components/CorporateAddItemDialog.vue'
import CorporateCountSheet from '@/features/orders/components/CorporateCountSheet.vue'
import CorporateOrderHeader from '@/features/orders/components/CorporateOrderHeader.vue'
import DocumentScannerOverlay from '@/features/orders/components/DocumentScannerOverlay.vue'
import OrderFormSectionHeader from '@/features/orders/components/OrderFormSectionHeader.vue'
import SlipPhotoControls from '@/features/orders/components/SlipPhotoControls.vue'
import { useCorporateOrderDraft } from '@/features/orders/composables/useCorporateOrderDraft'
import { aiGatewayBaseUrl, aiGatewayToken } from '@/shared/ai-gateway/ai-gateway.config'
import { useSlipReading } from '@/features/orders/composables/useSlipReading'
import { slipPrefill } from '@/features/orders/utils/slip-prefill'
import { useSlipOverlayRoute } from '@/features/orders/composables/useSlipOverlayRoute'
import { corporateOrderItems } from '@/features/orders/utils/corporate-order-items'
import { corporateOrderCreatePayload } from '@/features/orders/utils/corporate-order-draft'
import { useOrderStore } from '@/features/orders/stores/order.store'
import { useOrderImageStore } from '@/features/orders/stores/order-image.store'

defineOptions({ name: 'CorporateOrderPage' })

const route = useRoute()
const router = useRouter()
const orderStore = useOrderStore()
const orderImageStore = useOrderImageStore()
const { close: closeRoute } = useCloseRoute({ name: 'order-list' })
const customerStore = useCustomerStore()
const priceListStore = usePriceListStore()
const itemsStore = useItemsStore()
const { customers, loading: customersLoading, loaded: customersLoaded, error: customersError } = storeToRefs(customerStore)
const { items: priceListRows, loading: priceListLoading, loaded: priceListLoaded, error: priceListError } = storeToRefs(priceListStore)

const customerId = computed(() => (typeof route.params.customerId === 'string' ? route.params.customerId.trim() : ''))
const { draft, countedCount, total, setListItems, setStartingValues, setCounted, addLine, removeLine, setSlipPhoto, removeSlipPhoto } = useCorporateOrderDraft(() => customerId.value)
const gatewayBaseUrl = aiGatewayBaseUrl()
const reading = useSlipReading({ baseUrl: gatewayBaseUrl, getToken: aiGatewayToken })
const { status: readingStatus, error: readingError, warnings: readingWarnings, flaggedKeys } = reading
const isReading = computed(() => readingStatus.value === 'reading')
const pendingCapture = ref<File | null>(null)
let staffEdited = false
let applyingPrefill = false

watch(() => [draft.receivedDate, draft.dueDate], () => {
  if (!applyingPrefill) staffEdited = true
}, { flush: 'sync' })

watch(reading.result, (result) => {
  if (!result) return
  const prefill = slipPrefill(draft.lines, result)
  applyingPrefill = true
  setStartingValues(prefill.lines, prefill.receivedDate)
  applyingPrefill = false
  flaggedKeys.value = prefill.flaggedKeys
  staffEdited = false
}, { flush: 'sync' })

function countItem(key: string, counted: number | null): void {
  if (isReading.value) return
  setCounted(key, counted)
  staffEdited = true
}

function removeItem(key: string): void {
  if (isReading.value) return
  removeLine(key)
  staffEdited = true
}

function readCurrentPhoto(): void {
  const photo = draft.slipPhotos[0]
  const priceGroup = customer.value?.priceGroup
  if (!photo || !priceGroup || !gatewayBaseUrl || saving.value || savedOrderId.value) return
  addDialogOpen.value = false
  void reading.read(photo.file, priceGroup)
}

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
const saving = ref(false)
const savedOrderId = ref<string | null>(null)
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
  if (gatewayBaseUrl && customer.value?.priceGroup && staffEdited) {
    pendingCapture.value = file
    slip.close()
    return
  }
  storeCapture(file, overlay.retakeId !== null)
}

function storeCapture(file: File, returnToViewer: boolean): void {
  reading.cancel()
  const id = setSlipPhoto(file)
  readCurrentPhoto()
  if (returnToViewer) openViewer(id)
  else slip.close()
}

function confirmPendingCapture(): void {
  const file = pendingCapture.value
  pendingCapture.value = null
  if (file) storeCapture(file, false)
}

function onScannerClose(): void {
  const retakeId = scanOverlay.value?.retakeId
  if (retakeId) openViewer(retakeId)
  else slip.close()
}

function removeViewedPhoto(): void {
  reading.cancel()
  // Remounting the viewer destroys the old PhotoSwipe, which emits close; that close is not the user's.
  remountingViewer = true
  removeSlipPhoto()
  viewerRevision.value += 1
  slip.close()
  void nextTick(() => { remountingViewer = false })
}

function onViewerClose(): void {
  if (!remountingViewer) slip.close()
}

function addItem(name: string, counted: number | null): void {
  if (isReading.value) return
  addLine(name, counted)
  staffEdited = true
  addDialogOpen.value = false
}

async function save(): Promise<void> {
  if (saving.value || savedOrderId.value) return
  saveNotice.value = null
  if (!draft.lines.some((line) => line.counted !== null && line.counted > 0)) {
    saveNotice.value = 'Count at least one item before saving'
    return
  }
  saving.value = true
  try {
    await itemsStore.load()
    if (itemsStore.error) throw new Error(itemsStore.error)
    const payload = workOrderCreateSchema.parse(corporateOrderCreatePayload(draft, itemsStore.items, currentActor()))
    const photos = draft.slipPhotos.map((photo) => photo.file)
    const created = await orderStore.create(payload)
    savedOrderId.value = created.orderId
    let photosFailed = 0
    for (const file of photos) {
      await orderImageStore.captureImage({ orderId: created.orderId, imageType: 'DOCUMENT', file, quantity: null })
      if (orderImageStore.uploadError) photosFailed += 1
    }
    const failures = [
      created.itemsFailed ? 'Some item rows could not be saved.' : null,
      photosFailed > 0 ? `${photosFailed} slip photo(s) could not be uploaded.` : null,
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
  slip.clear()
  void customerStore.loadCustomers()
  void priceListStore.load()
  void itemsStore.load()
})
</script>

<template>
  <div class="relative flex h-full w-full flex-col overflow-hidden bg-surface font-body text-on-surface">
    <ScrollRegion>
      <CorporateOrderHeader :customer-name="customer?.customerName ?? null" :customer-sub="customerSub" :loading="customerLoading" :problem="customerProblem" v-model:received-date="draft.receivedDate" v-model:due-date="draft.dueDate" @close="closeRoute" />

      <div class="relative z-[1] -mt-4 rounded-t-2xl bg-surface px-4 pb-7 pt-4">
        <div>
          <OrderFormSectionHeader title="Count sheet" :subtitle="isReading ? 'Reading slip…' : `Slip order · ${countedCount} of ${draft.lines.length} counted`">
            <template #action>
              <SlipPhotoControls :photos="draft.slipPhotos" @scan="openScanner(draft.slipPhotos[0]?.id ?? null)" @view="openViewer(draft.slipPhotos[0]!.id)" />
            </template>
          </OrderFormSectionHeader>
          <ul v-if="readingWarnings.length" class="mb-3 list-disc pl-5 text-sm text-on-surface-variant" aria-label="Slip reading warnings">
            <li v-for="(warning, index) in readingWarnings" :key="index">{{ warning.message }}</li>
          </ul>
          <div v-if="readingStatus === 'failed'" class="mb-3 text-sm text-error" role="alert">
            {{ readingError }}
            <button type="button" class="ml-2 font-semibold underline" @click="readCurrentPhoto">Try again</button>
          </div>
          <p v-if="readingStatus === 'unavailable'" class="mb-3 text-sm text-on-surface-variant" role="status">AI reading unavailable — count by hand</p>
          <CorporateCountSheet
            :disabled="isReading"
            :flagged-keys="flaggedKeys"
            :lines="draft.lines"
            :total="total"
            :loading="sheetLoading"
            :error="sheetError"
            :empty-list="emptyList"
            @count="countItem"
            @remove="removeItem"
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
      <RouterLink v-if="savedOrderId && !saving" :to="{ name: 'order-detail', params: { orderId: savedOrderId } }" class="mb-2.5 block text-sm font-semibold text-primary underline">Open order {{ savedOrderId }}</RouterLink>
      <div class="flex gap-2.5">
        <button type="button" class="h-[52px] flex-1 rounded-full border-2 border-primary bg-white font-headline text-base font-bold text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime" :disabled="saving" @click="closeRoute">Discard</button>
        <button type="button" class="h-[52px] flex-1 rounded-full bg-primary font-headline text-base font-bold text-on-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime" :disabled="isReading || saving || savedOrderId !== null" @click="save">{{ saving ? 'Saving…' : 'Save order' }}</button>
      </div>
    </footer>

    <CorporateAddItemDialog :open="addDialogOpen" @close="addDialogOpen = false" @add="addItem" />
    <ConfirmOverlay
      :open="pendingCapture !== null"
      title="Read the new slip?"
      description="Its reading replaces the counts and received date you edited."
      cancel-label="Keep my counts"
      confirm-label="Read slip"
      @close="pendingCapture = null"
      @confirm="confirmPendingCapture"
    />
    <DocumentScannerOverlay :open="scanOverlay !== null" @close="onScannerClose" @capture="onCapture" />
    <PhotoViewer :key="viewerRevision" :images="viewerImages" :active-id="viewedPhotoId" @change="openViewer" @close="onViewerClose">
      <template #footer="{ image }">
        <div class="flex gap-3">
          <button type="button" class="inline-flex h-12 items-center gap-1.5 rounded-full border border-white/35 px-6 text-sm font-semibold text-white" @click="openScanner(image.id)">
            <span class="material-symbols-outlined text-[20px]" aria-hidden="true">flip_camera_ios</span>Retake
          </button>
          <button type="button" class="inline-flex h-12 items-center gap-1.5 rounded-full bg-error px-6 text-sm font-bold text-on-error" @click="removeViewedPhoto()">
            <span class="material-symbols-outlined text-[20px]" aria-hidden="true">delete</span>Remove
          </button>
        </div>
      </template>
    </PhotoViewer>
  </div>
</template>
