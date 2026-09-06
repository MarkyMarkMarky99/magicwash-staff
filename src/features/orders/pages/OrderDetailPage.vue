<script setup lang="ts">
import { serviceTypeLabel } from '@/shared/utils/service-type-labels'
import { computed, reactive, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import type { z } from 'zod'
import { orderItemCreateSchema } from '@contracts/order-items/order-item-api.schema'
import { orderServiceTypeSchema } from '@contracts/order-items/order-item-api.schema'
import { useRoute, useRouter } from 'vue-router'
import AppLayout from '@/shared/layouts/AppLayout.vue'
import ListContainer from '@/shared/components/ListContainer.vue'
import { formatSheetDate, normalizeSheetDate, sheetDateDaysBetween, todaySheetDate } from '@/shared/utils/sheet-date'
import OrderItemForm from '@/features/orders/components/OrderItemForm.vue'
import OrderPriceListPicker from '@/features/orders/components/OrderPriceListPicker.vue'
import OrderItemRow from '@/features/orders/components/OrderItemRow.vue'
import OrderItemsMenu from '@/features/orders/components/OrderItemsMenu.vue'
import CameraOverlay from '@/shared/components/CameraOverlay.vue'
import OrderImageSection from '@/features/orders/components/OrderImageSection.vue'
import { useOrderImageStore } from '@/features/orders/stores/order-image.store'
import OrderImageWeightPrompt from '@/features/orders/components/OrderImageWeightPrompt.vue'
import { useOrderOverlayRoute } from '@/features/orders/composables/use-order-overlay-route'
import { imageTypeToOverlay, overlayToImageType, readOrderImageWeight } from '@/features/orders/composables/use-order-overlay-route'
import type { OrderImageType } from '@/features/orders/order-image-labels'
import { presentationFor } from '@/features/orders/order-status-presentation'
import BaseBadge from '@/shared/components/BaseBadge.vue'
import { useOrderStore } from '@/features/orders/stores/order.store'
import { useOrderPriceListStore } from '@/features/orders/stores/order-price-list.store'
import type { OrderPriceListItemDto } from '@/features/orders/services/order-price-list.service'

const itemPayloadSchema = orderItemCreateSchema.omit({ orderId: true, createdBy: true })
const route = useRoute()
const router = useRouter()
const orderStore = useOrderStore()
const orderPriceListStore = useOrderPriceListStore()
const orderImageStore = useOrderImageStore()
const { currentOrder, detailLoading, detailError, itemSubmittingOrderId, itemError, itemErrorOrderId } = storeToRefs(orderStore)
const { images, imagesLoading, imagesError, uploadingCount, uploadError } = storeToRefs(orderImageStore)
const orderId = computed(() => String(route.params.orderId ?? ''))
const orderOverlay = reactive(useOrderOverlayRoute())
const selectedPriceListItem = ref<OrderPriceListItemDto | null>(null)
const savingItemOrderId = ref<string | null>(null)
let itemFlowSequence = 0
const pickerServiceType = computed(() => {
  if (currentOrder.value?.orderId !== orderId.value) return null
  const parsed = orderServiceTypeSchema.safeParse(currentOrder.value.serviceType)
  return parsed.success ? parsed.data : null
})
const isPriceListPickerOpen = computed(() => orderOverlay.isItemOpen && selectedPriceListItem.value === null)
const isItemFormOpen = computed(() => orderOverlay.isItemOpen && selectedPriceListItem.value !== null)
const pickerError = computed(() => detailError.value
  ?? (!detailLoading.value && !pickerServiceType.value ? 'ไม่พบบริการของออเดอร์ กรุณาลองโหลดใหม่' : null)
  ?? orderPriceListStore.error)
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
  if (id) {
    void orderStore.loadDetail(id)
    void orderImageStore.loadImages(id)
    return
  }
  orderStore.clearDetail()
  orderImageStore.clearImages()
}, { immediate: true })

watch([() => orderOverlay.isItemOpen, orderId, pickerServiceType], ([isOpen, , serviceType]) => {
  itemFlowSequence += 1
  selectedPriceListItem.value = null
  orderPriceListStore.reset()
  if (isOpen && serviceType) void orderPriceListStore.reload(serviceType)
}, { immediate: true })

function submitWeight(weight: number): void {
  orderOverlay.setWeight(weight)
}

function openCapture(imageType: OrderImageType): void {
  orderOverlay.open(imageTypeToOverlay[imageType])
}

function openItemOverlay(): void {
  orderOverlay.open('item')
}

function openOrderGallery(): void {
  if (!orderId.value) return
  void router.push(`/gallery/BEF-${orderId.value}`)
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
    await orderStore.addItem(orderItemCreateSchema.parse({ ...payload, orderId: targetOrderId, createdBy: 'admin' }))
    if (orderId.value !== targetOrderId) return
    await orderStore.loadDetail(targetOrderId)
    if (orderId.value === targetOrderId && flowSequence === itemFlowSequence) orderOverlay.close()
  } catch {
    return
  } finally {
    if (savingItemOrderId.value === targetOrderId) savingItemOrderId.value = null
  }
}

function selectPriceListItem(item: OrderPriceListItemDto): void {
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
    void orderStore.loadDetail(orderId.value)
  } else {
    void orderPriceListStore.reload(pickerServiceType.value)
  }
}

function clearItemError() {
  orderStore.clearItemError(orderId.value)
}
</script>

<template>
  <AppLayout><main class="min-h-0 flex-1 overflow-y-auto no-scrollbar bg-surface pb-8"><div v-if="detailLoading" class="space-y-4 p-4 animate-pulse"><div class="h-40 rounded-2xl bg-surface-container" /><div class="h-32 rounded-2xl bg-surface-container" /></div><p v-else-if="detailError" class="p-5 text-sm text-error">{{ detailError }}</p><template v-else-if="currentOrder"><div class="px-4 pt-4"><section class="relative overflow-hidden rounded-[20px] border border-mint/25 bg-primary px-5 pb-7 pt-4 text-on-primary shadow-sm"><div class="pointer-events-none absolute -right-[138px] -top-[112px] h-[270px] w-[270px] rounded-full border-[34px] border-mint/[0.17]" /><div class="pointer-events-none absolute -bottom-[21px] right-[38px] h-[42px] w-[42px] rounded-full bg-lime shadow-[-22px_-11px_0_rgba(178,223,38,0.22)]" /><div class="relative flex items-start justify-between gap-3"><p class="font-label text-[9px] font-bold uppercase tracking-[0.18em] text-mint">Order detail</p><BaseBadge class="-mt-1 shrink-0" :label="presentationFor(currentOrder.status).label" size="lg" :uppercase="true" :tone="presentationFor(currentOrder.status).tone" /></div><h1 class="relative mt-1 truncate font-headline text-[26px] font-bold leading-tight tracking-tight">{{ currentOrder.customerName?.trim() ? currentOrder.customerName : currentOrder.customerId }}</h1><p class="relative mt-2 inline-block rounded-md bg-white/15 px-2 py-0.5 font-label text-[11px] font-bold tracking-wide text-on-primary/90">#{{ currentOrder.orderNumber ?? currentOrder.orderId }}</p><div class="relative mt-4 border-t border-white/15 pt-3"><template v-if="laundryWindow"><div class="flex items-baseline justify-between gap-3"><p class="font-label text-[9px] font-bold uppercase tracking-[0.14em] text-mint">Laundry window · {{ laundryWindow.span }} days</p><p v-if="laundryWindow.remaining > 0" class="shrink-0 font-headline text-xs font-bold text-lime">เหลือ {{ laundryWindow.remaining }} วัน</p><p v-else-if="laundryWindow.remaining === 0" class="shrink-0 font-headline text-xs font-bold text-lime">ครบกำหนดวันนี้</p><p v-else class="shrink-0 rounded-full bg-error px-2 py-0.5 font-headline text-[11px] font-bold text-white">เลยกำหนด {{ -laundryWindow.remaining }} วัน</p></div><div class="relative mt-2 h-1.5 rounded-full bg-white/20"><div class="h-full rounded-full bg-mint" :style="{ width: laundryWindow.percent + '%' }" /><span class="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-mint bg-primary" :style="{ left: laundryWindow.percent + '%' }" /></div></template><div class="mt-3 flex items-start justify-between gap-3"><div class="min-w-0"><p class="font-label text-[9px] font-bold uppercase tracking-wider text-mint">รับผ้า</p><p class="mt-0.5 font-headline text-[13px] font-bold">{{ currentOrder.receivedDate ? formatSheetDate(currentOrder.receivedDate) : 'ยังไม่กำหนด' }}</p></div><div class="min-w-0 text-right"><p class="font-label text-[9px] font-bold uppercase tracking-wider text-mint">กำหนดส่ง</p><p class="mt-0.5 font-headline text-[13px] font-bold">{{ currentOrder.dueDate ? formatSheetDate(currentOrder.dueDate) : 'ยังไม่กำหนด' }}</p></div></div><div class="mt-3 flex items-start justify-between gap-3"><div class="min-w-0"><p class="font-label text-[9px] font-bold uppercase tracking-wider text-mint">Service</p><p class="mt-0.5 truncate font-headline text-[13px] font-bold">{{ serviceTypeLabel(currentOrder.serviceType) ?? '—' }}</p></div><div class="min-w-0 text-right"><p class="font-label text-[9px] font-bold uppercase tracking-wider text-mint">Quantity</p><p class="mt-0.5 font-headline text-[13px] font-bold">{{ currentOrder.quantity ?? '—' }}</p></div></div><div v-if="currentOrder.invoiceNumber" class="mt-3 flex items-start justify-between gap-3"><p class="font-label text-[9px] font-bold uppercase tracking-wider text-mint">Invoice</p><p class="min-w-0 truncate font-headline text-[13px] font-bold">{{ currentOrder.invoiceNumber }}</p></div></div></section></div><section v-if="currentOrder.note" class="mx-4 -mt-2 rounded-xl border border-outline-variant/20 bg-surface-container-low px-3 py-3 shadow-sm"><p class="font-label text-[9px] font-bold uppercase tracking-wider text-on-surface-variant">หมายเหตุ</p><p class="mt-1 whitespace-pre-wrap font-body text-sm leading-relaxed text-on-surface">{{ currentOrder.note }}</p></section><div class="mt-4"><ListContainer title="รายการสินค้า" icon="checkroom" :count="currentOrder.items.length" count-label="รายการ" :loading="detailLoading" :error="detailError ?? undefined" :empty="currentOrder.items.length === 0" empty-text="ยังไม่มีรายการสินค้า" :skeleton-rows="3"><template #actions><OrderItemsMenu @add-item="openItemOverlay" @open-album="openOrderGallery" /></template><OrderItemRow v-for="(item, index) in currentOrder.items" :key="item.orderItemId ?? `${currentOrder.orderId}-${index}`" :item="item" :index="index" @select="openItemGallery" /></ListContainer></div><OrderImageSection :images="images" :loading="imagesLoading" :error="imagesError" :upload-error="uploadError" :uploading-count="uploadingCount" @capture="openCapture" @clear-upload-error="orderImageStore.clearUploadError" /></template><p v-else class="p-5 text-sm text-on-surface-variant">ไม่พบออเดอร์นี้</p></main><OrderImageWeightPrompt :open="isWeightPromptOpen" @submit="submitWeight" @close="orderOverlay.close" /><CameraOverlay :open="isCameraOpen" @close="orderOverlay.close" @capture="handleCapture" /></AppLayout>
  <OrderPriceListPicker
    v-if="selectedPriceListItem === null"
    :open="isPriceListPickerOpen"
    :items="orderPriceListStore.items"
    :loading="detailLoading || orderPriceListStore.loading"
    :error="pickerError"
    :truncated="orderPriceListStore.truncated"
    :service-type="pickerServiceType"
    :order-label="orderId"
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
