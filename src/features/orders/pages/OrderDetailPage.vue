<script setup lang="ts">
import { serviceTypeLabel } from '@/shared/utils/service-type-labels'
import { computed, reactive, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import type { z } from 'zod'
import { orderItemCreateSchema } from '@contracts/order-items/order-item-api.schema'
import { orderServiceTypeSchema } from '@contracts/order-items/order-item-api.schema'
import { useRoute, useRouter } from 'vue-router'
import AppLayout from '@/shared/layouts/AppLayout.vue'
import LightboxOverlay from '@/shared/layouts/LightboxOverlay.vue'
import ListContainer from '@/shared/components/ListContainer.vue'
import ScrollRegion from '@/shared/components/ScrollRegion.vue'
import { formatSheetDate, normalizeSheetDate, sheetDateDaysBetween, todaySheetDate } from '@/shared/utils/sheet-date'
import OrderItemForm from '@/features/orders/components/OrderItemForm.vue'
import PriceListItemPicker from '@/features/price-list/components/PriceListItemPicker.vue'
import OrderItemRow from '@/features/orders/components/OrderItemRow.vue'
import OrderItemsMenu from '@/features/orders/components/OrderItemsMenu.vue'
import OrderTagPrintAction from '@/features/orders/components/OrderTagPrintAction.vue'
import OrderTagPrintConfirmDialog from '@/features/orders/components/OrderTagPrintConfirmDialog.vue'
import CameraOverlay from '@/shared/components/CameraOverlay.vue'
import DocumentScannerOverlay from '@/features/orders/components/DocumentScannerOverlay.vue'
import OrderImageSection from '@/features/orders/components/OrderImageSection.vue'
import { useOrderImageStore } from '@/features/orders/stores/order-image.store'
import { listLaundryPhotos } from '@/data/laundry-photos/laundry-photo.service'
import OrderImageWeightPrompt from '@/features/orders/components/OrderImageWeightPrompt.vue'
import { useOrderOverlayRoute } from '@/features/orders/composables/use-order-overlay-route'
import { imageTypeToOverlay, overlayToImageType, readOrderImageWeight } from '@/features/orders/composables/use-order-overlay-route'
import type { OrderImageType } from '@/features/orders/order-image-labels'
import { presentationFor } from '@/features/orders/order-status-presentation'
import BaseBadge from '@/shared/components/BaseBadge.vue'
import { useOrderStore } from '@/features/orders/stores/order.store'
import { useWorkOrderStore } from '@/data/work-orders/work-order.store'
import { useCustomerStore } from '@/data/customers/customer.store'
import { usePriceListStore } from '@/data/price-list/price-list.store'
import type { PriceListDto } from '@/data/price-list/price-list.service'
import { filterOrderPriceListItems } from '@/features/orders/utils/order-price-list-items'
import { currentActor } from '@/shared/config/actor'
import { createLaundryTagPrintRequest, printLaundryTags } from '@/data/laundry-tag-prints/laundry-tag-print.service'
import { ApiError } from '@/shared/api/api-client'

const itemPayloadSchema = orderItemCreateSchema.omit({ orderId: true, createdBy: true })
const route = useRoute()
const router = useRouter()
const orderStore = useOrderStore()
const workOrderStore = useWorkOrderStore()
const customerStore = useCustomerStore()
const priceListStore = usePriceListStore()
const orderImageStore = useOrderImageStore()
const { customers } = storeToRefs(customerStore)
const { currentOrder, detailLoading, detailError } = storeToRefs(workOrderStore)
const { itemSubmittingOrderId, itemError, itemErrorOrderId } = storeToRefs(orderStore)
const { images, imagesLoading, imagesError, uploadingCount, uploadError } = storeToRefs(orderImageStore)
const orderId = computed(() => String(route.params.orderId ?? ''))
const orderOverlay = reactive(useOrderOverlayRoute())
const selectedPriceListItem = ref<PriceListDto | null>(null)
const selectedImagePreview = ref<{ src: string, alt: string } | null>(null)
const savingItemOrderId = ref<string | null>(null)
const tagPrinting = ref(false)
const tagPrintSuccess = ref<string | null>(null)
const tagPrintError = ref<string | null>(null)
const tagPrintConfirmOpen = ref(false)
let itemFlowSequence = 0
const customersById = computed(() => new Map(
  customers.value.map((customer) => [customer.customerId, customer]),
))
const currentCustomerName = computed(() => {
  const customerId = currentOrder.value?.customerId ?? ''
  const customerName = customersById.value.get(customerId)?.customerName
  return customerName?.trim() ? customerName : customerId
})
const currentCustomerIndex = computed(() =>
  customersById.value.get(currentOrder.value?.customerId ?? '')?.customerIndex ?? null,
)
const tagCount = computed(() => {
  const items = currentOrder.value?.items ?? []
  if (items.length === 0 || items.some((item) =>
    item.quantity === null || !Number.isInteger(item.quantity) || item.quantity < 1
  )) return null
  const count = items.reduce((sum, item) => sum + item.quantity!, 0)
  return Math.min(count, 999)
})
const canPrintTags = computed(() =>
  !detailLoading.value && Boolean(currentCustomerIndex.value?.trim()) && tagCount.value !== null,
)
const pickerServiceType = computed(() => {
  if (currentOrder.value?.orderId !== orderId.value) return null
  const parsed = orderServiceTypeSchema.safeParse(currentOrder.value.serviceType)
  return parsed.success ? parsed.data : null
})
const pickerItems = computed(() =>
  filterOrderPriceListItems(priceListStore.items, pickerServiceType.value),
)
const isPriceListPickerOpen = computed(() => orderOverlay.isItemOpen && selectedPriceListItem.value === null)
const isItemFormOpen = computed(() => orderOverlay.isItemOpen && selectedPriceListItem.value !== null)
const pickerError = computed(() => detailError.value
  ?? (!detailLoading.value && !pickerServiceType.value ? 'Order service type not found. Please try reloading.' : null)
  ?? priceListStore.error)
const captureImageType = computed<OrderImageType | null>(() => {
  const overlay = orderOverlay.activeOverlay
  if (overlay === null || overlay === 'item') return null
  return overlayToImageType[overlay]
})
const captureWeight = computed<number | null>(() => {
  if (captureImageType.value !== 'WEIGHT') return null
  return readOrderImageWeight(route.query)
})
const isWeightPromptOpen = computed<boolean>(() => captureImageType.value === 'WEIGHT' && captureWeight.value === null)
const isCameraOpen = computed<boolean>(() => captureImageType.value !== null && !isWeightPromptOpen.value)
// Only DOCUMENT gets the scanner; WEIGHT and BELONGING keep the shared camera. Only one
// of the two overlays may ever be open — the other gets :open="false" so its own camera
// stream actually stops rather than merely being hidden.
const isDocumentScannerOpen = computed<boolean>(() => isCameraOpen.value && captureImageType.value === 'DOCUMENT')
const isSimpleCameraOpen = computed<boolean>(() => isCameraOpen.value && captureImageType.value !== 'DOCUMENT')
const laundryWindow = computed(() => {
  const order = currentOrder.value
  if (!order) return null
  const start = normalizeSheetDate(order.receivedDate)
  const end = normalizeSheetDate(order.dueDate)
  if (!start || !end) return null
  const span = sheetDateDaysBetween(end, start)
  if (span === null || span <= 0) return null
  const today = todaySheetDate()
  const remaining = sheetDateDaysBetween(end, today)
  const elapsed = sheetDateDaysBetween(today, start)
  if (remaining === null || elapsed === null) return null
  const percent = Math.min(100, Math.max(0, (elapsed / span) * 100))
  return { span, remaining, percent }
})
const itemSubmitting = computed(() => itemSubmittingOrderId.value === orderId.value || savingItemOrderId.value === orderId.value)
const currentItemError = computed(() => itemErrorOrderId.value === orderId.value ? itemError.value : null)
watch(orderId, (id) => {
  selectedImagePreview.value = null
  tagPrintSuccess.value = null
  tagPrintError.value = null
  tagPrintConfirmOpen.value = false
  if (id) {
    void workOrderStore.loadDetail(id)
    void orderImageStore.loadImages(id)
    void listLaundryPhotos(id).catch(() => {})
    return
  }
  workOrderStore.clearDetail()
  orderImageStore.clearImages()
}, { immediate: true })

watch([canPrintTags, tagPrinting], ([canPrint, printing]) => {
  if (!canPrint && !printing) tagPrintConfirmOpen.value = false
})
watch([() => orderOverlay.isItemOpen, orderId, pickerServiceType], ([isOpen, , serviceType]) => {
  itemFlowSequence += 1
  selectedPriceListItem.value = null
  if (isOpen && serviceType) void priceListStore.load()
}, { immediate: true })

function submitWeight(weight: number): void {
  orderOverlay.setWeight(weight)
}

function openCapture(imageType: OrderImageType): void {
  orderOverlay.open(imageTypeToOverlay[imageType])
}

function openImagePreview(src: string, alt: string): void {
  selectedImagePreview.value = { src, alt }
}

function openItemOverlay(): void {
  orderOverlay.open('item')
}

function openOrderGallery(): void {
  if (!orderId.value) return
  void router.push(`/gallery/BEF-${orderId.value}`)
}

function openTagPrintConfirm(): void {
  if (!canPrintTags.value || tagPrinting.value) return
  tagPrintSuccess.value = null
  tagPrintError.value = null
  tagPrintConfirmOpen.value = true
}

function closeTagPrintConfirm(): void {
  if (!tagPrinting.value) tagPrintConfirmOpen.value = false
}

async function handlePrintTags(totalCount: number): Promise<void> {
  const order = currentOrder.value
  const customerIndex = currentCustomerIndex.value
  if (!order || !customerIndex || !canPrintTags.value || tagPrinting.value) return
  const printedOrderId = order.orderId
  tagPrinting.value = true
  tagPrintSuccess.value = null
  tagPrintError.value = null

  try {
    const request = createLaundryTagPrintRequest(order, customerIndex, totalCount)
    const result = await printLaundryTags(request)
    if (orderId.value === printedOrderId) {
      tagPrintConfirmOpen.value = false
      tagPrintSuccess.value = 'ส่งแท็ก ' + result.totalCount + ' ใบไปยัง ' + result.printerName + ' แล้ว'
    }
  } catch (reason) {
    if (orderId.value !== printedOrderId) return
    if (reason instanceof ApiError && reason.status === 422) {
      tagPrintError.value = 'ข้อมูลแท็กไม่ถูกต้อง กรุณาโหลดออเดอร์ใหม่แล้วลองอีกครั้ง'
    } else if (reason instanceof ApiError && reason.status === 502) {
      tagPrintError.value = 'ไม่สามารถติดต่อเครื่องพิมพ์แท็กได้ กรุณาตรวจสอบเครื่องพิมพ์'
    } else {
      tagPrintError.value = 'ส่งคำขอพิมพ์แท็กไม่สำเร็จ กรุณาตรวจสอบเครื่องพิมพ์ก่อนลองอีกครั้ง'
    }
  } finally {
    tagPrinting.value = false
  }
}
function openItemGallery(orderItemId: string, itemId: string | null): void {
  if (!orderId.value || !orderItemId) return
  const normalizedItemId = itemId?.trim()
  const query = normalizedItemId && normalizedItemId !== 'null' ? { itemId: normalizedItemId } : undefined
  void router.push({ path: `/gallery/BEF-${orderId.value}-${orderItemId}`, query })
}

async function handleCapture(file: File): Promise<void> {
  const imageType = captureImageType.value
  const targetOrderId = orderId.value
  const quantity = captureWeight.value
  if (imageType === null || targetOrderId === '') return
  await orderImageStore.captureImage({ orderId: targetOrderId, imageType, file, quantity })
}
async function addItem(payload: z.infer<typeof itemPayloadSchema>) {
  if (!selectedPriceListItem.value || !pickerServiceType.value || itemSubmitting.value) return
  const targetOrderId = orderId.value
  const flowSequence = itemFlowSequence
  savingItemOrderId.value = targetOrderId
  try {
    await orderStore.addItem(orderItemCreateSchema.parse({ ...payload, orderId: targetOrderId, createdBy: currentActor() }))
    if (orderId.value !== targetOrderId) return
    await workOrderStore.loadDetail(targetOrderId)
    if (orderId.value === targetOrderId && flowSequence === itemFlowSequence) orderOverlay.close()
  } catch {
    return
  } finally {
    if (savingItemOrderId.value === targetOrderId) savingItemOrderId.value = null
  }
}

function selectPriceListItem(item: PriceListDto): void {
  selectedPriceListItem.value = item
  clearItemError()
}

function changePriceListItem(): void {
  selectedPriceListItem.value = null
  clearItemError()
}

function closePriceListPicker(): void {
  if (isPriceListPickerOpen.value) orderOverlay.close()
}

function closeItemForm(): void {
  if (isItemFormOpen.value) orderOverlay.close()
}

function retryPriceList(): void {
  if (detailError.value || !pickerServiceType.value) {
    void workOrderStore.loadDetail(orderId.value)
  } else {
    void priceListStore.load(true)
  }
}

function clearItemError() {
  orderStore.clearItemError(orderId.value)
}
</script>

<template>
  <AppLayout><ScrollRegion as="main" class="bg-surface pb-8"><div v-if="detailLoading && !currentOrder" class="space-y-4 p-4 animate-pulse"><div class="h-40 rounded-2xl bg-surface-container" /><div class="h-32 rounded-2xl bg-surface-container" /></div><p v-else-if="detailError" class="p-5 text-sm text-error">{{ detailError }}</p><template v-else-if="currentOrder"><div class="space-y-4 p-4"><section class="relative overflow-hidden rounded-[20px] border border-mint/25 bg-primary px-5 pb-4 pt-3 text-on-primary shadow-lg"><div class="pointer-events-none absolute -right-[138px] -top-[112px] h-[270px] w-[270px] rounded-full border-[34px] border-mint/[0.17]" /><div class="pointer-events-none absolute -bottom-[21px] right-[38px] h-[42px] w-[42px] rounded-full bg-lime shadow-[-22px_-11px_0_rgba(178,223,38,0.22)]" /><div class="relative flex items-start justify-between gap-3"><p class="font-label text-[9px] font-bold uppercase tracking-[0.18em] text-mint">Order detail</p><BaseBadge class="-mt-1 shrink-0" :label="presentationFor(currentOrder.status).label" size="lg" :uppercase="true" :tone="presentationFor(currentOrder.status).tone" /></div><h1 class="relative mt-1 truncate font-headline text-[26px] font-bold leading-tight tracking-tight">{{ currentCustomerName }}</h1><div class="relative mt-2 border-t border-white/15 pt-2"><template v-if="laundryWindow"><div class="flex items-baseline justify-between gap-3"><p class="font-label text-[9px] font-bold uppercase tracking-[0.14em] text-mint">Laundry window · {{ laundryWindow.span }} days</p><p v-if="laundryWindow.remaining > 0" class="shrink-0 font-headline text-xs font-bold text-lime">{{ laundryWindow.remaining }} days left</p><p v-else-if="laundryWindow.remaining === 0" class="shrink-0 font-headline text-xs font-bold text-lime">Due today</p><p v-else class="shrink-0 rounded-full bg-error px-2 py-0.5 font-headline text-[11px] font-bold text-white">{{ -laundryWindow.remaining }} days overdue</p></div><div class="relative mt-1.5 h-1.5 rounded-full bg-white/20"><div class="h-full rounded-full bg-mint" :style="{ width: laundryWindow.percent + '%' }" /><span class="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-mint bg-primary" :style="{ left: laundryWindow.percent + '%' }" /></div></template><div class="mt-2 flex items-start justify-between gap-3"><div class="min-w-0"><p class="font-label text-[9px] font-bold uppercase tracking-wider text-mint">Pickup</p><p class="mt-0.5 font-headline text-[13px] font-bold">{{ currentOrder.receivedDate ? formatSheetDate(currentOrder.receivedDate) : 'Not set' }}</p></div><div class="min-w-0 text-right"><p class="font-label text-[9px] font-bold uppercase tracking-wider text-mint">Due</p><p class="mt-0.5 font-headline text-[13px] font-bold">{{ currentOrder.dueDate ? formatSheetDate(currentOrder.dueDate) : 'Not set' }}</p></div></div><div class="mt-2 flex items-start justify-between gap-3"><div class="min-w-0"><p class="font-label text-[9px] font-bold uppercase tracking-wider text-mint">Service</p><p class="mt-0.5 truncate font-headline text-[13px] font-bold">{{ serviceTypeLabel(currentOrder.serviceType) ?? '—' }}</p></div><div class="min-w-0 text-right"><p class="font-label text-[9px] font-bold uppercase tracking-wider text-mint">Quantity</p><p class="mt-0.5 font-headline text-[13px] font-bold">{{ currentOrder.quantity ?? '—' }}</p></div></div><div v-if="currentOrder.invoiceNumber" class="mt-2 flex items-start justify-between gap-3"><p class="font-label text-[9px] font-bold uppercase tracking-wider text-mint">Invoice</p><p class="min-w-0 truncate font-headline text-[13px] font-bold">{{ currentOrder.invoiceNumber }}</p></div></div></section><section v-if="currentOrder.note" class="rounded-xl border border-outline-variant/20 bg-surface-container-low px-3 py-3 shadow-sm"><p class="font-label text-[9px] font-bold uppercase tracking-wider text-on-surface-variant">Note</p><p class="mt-1 whitespace-pre-wrap font-body text-sm leading-relaxed text-on-surface">{{ currentOrder.note }}</p></section><div><ListContainer class="overflow-hidden rounded-2xl shadow-sm" title="Items" icon="checkroom" :count="detailLoading ? undefined : currentOrder.items.length" count-label="items" :loading="detailLoading" :error="detailError ?? undefined" :empty="currentOrder.items.length === 0" empty-text="No items yet" :skeleton-rows="3"><template #actions><OrderItemsMenu @add-item="openItemOverlay" @open-album="openOrderGallery" /></template><OrderItemRow v-for="(item, index) in currentOrder.items" :key="item.orderItemId ?? `${currentOrder.orderId}-${index}`" :item="item" :index="index" @select="openItemGallery" /></ListContainer><OrderTagPrintAction :total-count="tagCount" :can-print="canPrintTags" :printing="tagPrinting" :print-success="tagPrintSuccess" :print-error="tagPrintError" @print="openTagPrintConfirm" /></div><div class="-mx-4"><OrderImageSection :images="images" :loading="imagesLoading" :error="imagesError" :upload-error="uploadError" :uploading-count="uploadingCount" @capture="openCapture" @clear-upload-error="orderImageStore.clearUploadError" @preview="openImagePreview" /></div></div></template><p v-else class="p-5 text-sm text-on-surface-variant">Order not found</p></ScrollRegion><OrderImageWeightPrompt :open="isWeightPromptOpen" @submit="submitWeight" @close="orderOverlay.close" /><CameraOverlay :open="isSimpleCameraOpen" @close="orderOverlay.close" @capture="handleCapture" /><DocumentScannerOverlay :open="isDocumentScannerOpen" @close="orderOverlay.close" @capture="handleCapture" /></AppLayout>
  <OrderTagPrintConfirmDialog
    :open="tagPrintConfirmOpen"
    :total-count="tagCount ?? 1"
    :printing="tagPrinting"
    @close="closeTagPrintConfirm"
    @confirm="handlePrintTags"
  />
  <LightboxOverlay
    :open="selectedImagePreview !== null"
    :ariaLabel="selectedImagePreview?.alt ?? 'View order photo'"
    @close="selectedImagePreview = null"
  >
    <img
      v-if="selectedImagePreview"
      :src="selectedImagePreview.src"
      :alt="selectedImagePreview.alt"
      class="max-h-[80dvh] max-w-full rounded-2xl object-contain"
      @click.stop
    >
  </LightboxOverlay>
  <PriceListItemPicker
    v-if="selectedPriceListItem === null"
    :open="isPriceListPickerOpen"
    :detail="`${orderId} · ${pickerServiceType ? serviceTypeLabel(pickerServiceType) : '—'}`"
    :items="pickerItems"
    :loading="detailLoading || priceListStore.loading"
    :error="pickerError"
    :truncated="priceListStore.truncated"
    @close="closePriceListPicker"
    @retry="retryPriceList"
    @select="selectPriceListItem"
  />
  <OrderItemForm
    v-else
    :open="isItemFormOpen"
    :order-id="orderId"
    :selected-item="selectedPriceListItem"
    :is-submitting="itemSubmitting"
    :error="currentItemError"
    @close="closeItemForm"
    @change-item="changePriceListItem"
    @submit="addItem"
    @clear-error="clearItemError"
  />
</template>
