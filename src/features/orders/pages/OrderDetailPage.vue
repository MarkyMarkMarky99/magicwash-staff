<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import { storeToRefs } from 'pinia'
import type { z } from 'zod'
import { orderItemCreateSchema } from '@contracts/order-items/order-item-api.schema'
import { useRoute } from 'vue-router'
import AppLayout from '@/shared/layouts/AppLayout.vue'
import ListContainer from '@/shared/components/ListContainer.vue'
import { formatSheetDate } from '@/shared/utils/sheet-date'
import OrderItemForm from '@/features/orders/components/OrderItemForm.vue'
import OrderItemRow from '@/features/orders/components/OrderItemRow.vue'
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

const itemPayloadSchema = orderItemCreateSchema.omit({ orderId: true, createdBy: true })
const route = useRoute()
const orderStore = useOrderStore()
const orderImageStore = useOrderImageStore()
const { currentOrder, detailLoading, detailError, itemSubmittingOrderId, itemError, itemErrorOrderId } = storeToRefs(orderStore)
const { images, imagesLoading, imagesError, uploadingCount, uploadError } = storeToRefs(orderImageStore)
const orderId = computed(() => String(route.params.orderId ?? ''))
const orderOverlay = reactive(useOrderOverlayRoute())
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
const itemSubmitting = computed(() => itemSubmittingOrderId.value === orderId.value)
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

function submitWeight(weight: number): void {
  orderOverlay.setWeight(weight)
}

function openCapture(imageType: OrderImageType): void {
  orderOverlay.open(imageTypeToOverlay[imageType])
}

async function handleCapture(file: File): Promise<void> {
  const imageType = captureImageType.value
  const targetOrderId = orderId.value
  const quantity = captureWeight.value
  if (imageType === null || targetOrderId === '') return
  await orderImageStore.captureImage({ orderId: targetOrderId, imageType, file, quantity })
}
async function addItem(payload: z.infer<typeof itemPayloadSchema>) {
  if (!currentOrder.value) return
  const targetOrderId = currentOrder.value.orderId
  try {
    await orderStore.addItem(orderItemCreateSchema.parse({ ...payload, orderId: targetOrderId, createdBy: 'admin' }))
  } catch {
    return
  }
  if (orderId.value !== targetOrderId) return
  await orderStore.loadDetail(targetOrderId)
  if (orderId.value === targetOrderId) orderOverlay.close()
}

function clearItemError() {
  orderStore.clearItemError(orderId.value)
}
</script>

<template>
  <AppLayout><main class="min-h-0 flex-1 overflow-y-auto bg-surface pb-8"><div v-if="detailLoading" class="space-y-4 p-4 animate-pulse"><div class="h-40 rounded-2xl bg-surface-container" /><div class="h-32 rounded-2xl bg-surface-container" /></div><p v-else-if="detailError" class="p-5 text-sm text-error">{{ detailError }}</p><template v-else-if="currentOrder"><section class="relative overflow-hidden bg-primary px-5 pb-6 pt-5 text-on-primary"><div class="absolute -right-12 -top-16 h-48 w-48 rounded-full border-[26px] border-white/10" /><p class="relative font-label text-[9px] font-bold uppercase tracking-[0.18em] text-on-primary/65">Order detail</p><div class="relative mt-1 flex items-start justify-between gap-3"><div class="min-w-0"><h1 class="truncate font-headline text-2xl font-bold tracking-tight">{{ currentOrder.orderNumber ?? currentOrder.orderId }}</h1><p class="mt-1 font-body text-sm text-on-primary/80">{{ currentOrder.customerName?.trim() ? currentOrder.customerName : currentOrder.customerId }}</p></div><BaseBadge :label="presentationFor(currentOrder.status).label" size="lg" :uppercase="true" :tone="presentationFor(currentOrder.status).tone" /></div><div class="relative mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-white/15"><div class="bg-primary/70 p-3"><p class="font-label text-[9px] font-bold uppercase tracking-wider text-on-primary/60">รับผ้า</p><p class="mt-1 font-headline text-xs font-bold">{{ currentOrder.receivedDate ? formatSheetDate(currentOrder.receivedDate) : 'ยังไม่กำหนด' }}</p></div><div class="bg-primary/70 p-3"><p class="font-label text-[9px] font-bold uppercase tracking-wider text-on-primary/60">กำหนดส่ง</p><p class="mt-1 font-headline text-xs font-bold">{{ currentOrder.dueDate ? formatSheetDate(currentOrder.dueDate) : 'ยังไม่กำหนด' }}</p></div></div><div class="relative mt-3 flex items-center justify-between rounded-xl border border-white/15 bg-white/10 px-3 py-2"><span class="font-label text-[10px] font-bold uppercase tracking-widest text-on-primary/70">Service</span><strong class="font-label text-xs">{{ currentOrder.serviceType ?? '—' }}</strong></div><div class="relative mt-3 grid grid-cols-2 gap-2"><div class="rounded-xl border border-white/15 bg-white/10 px-3 py-2"><p class="font-label text-[9px] font-bold uppercase tracking-widest text-on-primary/70">จำนวน</p><p class="mt-1 font-label text-xs font-bold">{{ currentOrder.quantity ?? '—' }}</p></div><div v-if="currentOrder.invoiceNumber" class="rounded-xl border border-white/15 bg-white/10 px-3 py-2"><p class="font-label text-[9px] font-bold uppercase tracking-widest text-on-primary/70">Invoice</p><p class="mt-1 truncate font-label text-xs font-bold">{{ currentOrder.invoiceNumber }}</p></div></div></section><section v-if="currentOrder.note" class="mx-4 -mt-2 rounded-xl border border-outline-variant/20 bg-surface-container-low px-3 py-3 shadow-sm"><p class="font-label text-[9px] font-bold uppercase tracking-wider text-on-surface-variant">หมายเหตุ</p><p class="mt-1 whitespace-pre-wrap font-body text-sm leading-relaxed text-on-surface">{{ currentOrder.note }}</p></section><div class="mt-4"><ListContainer title="รายการสินค้า" icon="checkroom" :count="currentOrder.items.length" count-label="รายการ" :loading="detailLoading" :error="detailError" :empty="currentOrder.items.length === 0" empty-text="ยังไม่มีรายการสินค้า" :skeleton-rows="3"><template #actions><button type="button" class="rounded-full bg-primary px-2.5 py-1 font-label text-[9px] font-bold text-on-primary" @click.stop="orderOverlay.open('item')">เพิ่มรายการ</button></template><OrderItemRow v-for="(item, index) in currentOrder.items" :key="item.orderItemId ?? `${currentOrder.orderId}-${index}`" :item="item" :index="index" /></ListContainer></div><OrderImageSection :images="images" :loading="imagesLoading" :error="imagesError" :upload-error="uploadError" :uploading-count="uploadingCount" @capture="openCapture" @clear-upload-error="orderImageStore.clearUploadError" /></template><p v-else class="p-5 text-sm text-on-surface-variant">ไม่พบออเดอร์นี้</p></main><OrderItemForm :open="orderOverlay.isItemOpen" :order-id="orderId" :is-submitting="itemSubmitting" :error="currentItemError" @close="orderOverlay.close" @submit="addItem" @clear-error="clearItemError" /><OrderImageWeightPrompt :open="isWeightPromptOpen" @submit="submitWeight" @close="orderOverlay.close" /><CameraOverlay :open="isCameraOpen" @close="orderOverlay.close" @capture="handleCapture" /></AppLayout>
</template>
