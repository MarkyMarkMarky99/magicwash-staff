<script setup lang="ts">
import { computed, onBeforeUnmount, watch } from 'vue'
import { storeToRefs } from 'pinia'
import type { z } from 'zod'
import { orderItemCreateSchema } from '@contracts/order-items/order-item-api.schema'
import { useRoute } from 'vue-router'
import AppLayout from '@/shared/layouts/AppLayout.vue'
import ListContainer from '@/shared/components/ListContainer.vue'
import { formatSheetDate } from '@/shared/utils/sheet-date'
import OrderCaptureOverlay from '@/features/orders/components/OrderCaptureOverlay.vue'
import OrderItemForm from '@/features/orders/components/OrderItemForm.vue'
import OrderItemRow from '@/features/orders/components/OrderItemRow.vue'
import OrderPhotoStrip from '@/features/orders/components/OrderPhotoStrip.vue'
import { useOrderOverlayRoute } from '@/features/orders/composables/use-order-overlay-route'
import { useOrderStore } from '@/features/orders/stores/order.store'

const itemPayloadSchema = orderItemCreateSchema.omit({ orderId: true, createdBy: true })
const route = useRoute()
const orderStore = useOrderStore()
const { currentOrder, detailLoading, detailError, itemSubmitting, itemError, orderPhotos } = storeToRefs(orderStore)
const orderId = computed(() => String(route.params.orderId ?? ''))
const itemOverlay = useOrderOverlayRoute({ queryKey: 'item', queryValue: 'new' })
const captureOverlay = useOrderOverlayRoute({ queryKey: 'capture', queryValue: '1' })
watch(orderId, (id) => { if (id) void orderStore.loadDetail(id) }, { immediate: true })
onBeforeUnmount(() => orderStore.clearDetail())
async function addItem(payload: z.infer<typeof itemPayloadSchema>) {
  if (!currentOrder.value) return
  await orderStore.addItem(orderItemCreateSchema.parse({ ...payload, orderId: currentOrder.value.orderId, createdBy: 'admin' }))
  itemOverlay.close()
}

function clearItemError() {
  itemError.value = null
}
</script>

<template>
  <AppLayout><main class="min-h-0 flex-1 overflow-y-auto bg-surface pb-8"><div v-if="detailLoading" class="space-y-4 p-4 animate-pulse"><div class="h-40 rounded-2xl bg-surface-container" /><div class="h-32 rounded-2xl bg-surface-container" /></div><p v-else-if="detailError" class="p-5 text-sm text-error">{{ detailError }}</p><template v-else-if="currentOrder"><section class="relative overflow-hidden bg-primary px-5 pb-6 pt-5 text-on-primary"><div class="absolute -right-12 -top-16 h-48 w-48 rounded-full border-[26px] border-white/10" /><p class="relative font-label text-[9px] font-bold uppercase tracking-[0.18em] text-on-primary/65">Order detail</p><div class="relative mt-1 flex items-start justify-between gap-3"><div class="min-w-0"><h1 class="truncate font-headline text-2xl font-bold tracking-tight">{{ currentOrder.orderNumber ?? currentOrder.orderId }}</h1><p class="mt-1 font-body text-sm text-on-primary/80">{{ currentOrder.customerId }}</p></div><span class="rounded-full bg-secondary px-2.5 py-1 font-label text-[10px] font-bold tracking-wide text-on-secondary">{{ currentOrder.status ?? '—' }}</span></div><div class="relative mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-white/15"><div class="bg-primary/70 p-3"><p class="font-label text-[9px] font-bold uppercase tracking-wider text-on-primary/60">รับผ้า</p><p class="mt-1 font-headline text-xs font-bold">{{ currentOrder.receivedDate ? formatSheetDate(currentOrder.receivedDate) : 'ยังไม่กำหนด' }}</p></div><div class="bg-primary/70 p-3"><p class="font-label text-[9px] font-bold uppercase tracking-wider text-on-primary/60">กำหนดส่ง</p><p class="mt-1 font-headline text-xs font-bold">{{ currentOrder.dueDate ? formatSheetDate(currentOrder.dueDate) : 'ยังไม่กำหนด' }}</p></div></div><div class="relative mt-3 flex items-center justify-between rounded-xl border border-white/15 bg-white/10 px-3 py-2"><span class="font-label text-[10px] font-bold uppercase tracking-widest text-on-primary/70">Service</span><strong class="font-label text-xs">{{ currentOrder.serviceType ?? '—' }}</strong></div></section><section v-if="currentOrder.note" class="mx-4 -mt-2 rounded-xl border border-outline-variant/20 bg-surface-container-low px-3 py-3 shadow-sm"><p class="font-label text-[9px] font-bold uppercase tracking-wider text-on-surface-variant">หมายเหตุ</p><p class="mt-1 whitespace-pre-wrap font-body text-sm leading-relaxed text-on-surface">{{ currentOrder.note }}</p></section><div class="mt-4"><ListContainer title="รายการสินค้า" icon="checkroom" :count="currentOrder.items.length" count-label="รายการ" collapsible :loading="detailLoading" :error="detailError" :empty="currentOrder.items.length === 0" empty-text="ยังไม่มีรายการสินค้า" :skeleton-rows="3"><template #actions><button type="button" class="rounded-full bg-primary px-2.5 py-1 font-label text-[9px] font-bold text-on-primary" @click.stop="itemOverlay.open">เพิ่มรายการ</button></template><OrderItemRow v-for="(item, index) in currentOrder.items" :key="item.orderItemId ?? `${currentOrder.orderId}-${index}`" :item="item" :index="index" /></ListContainer></div><OrderPhotoStrip :photos="orderPhotos" @capture="captureOverlay.open" /></template><p v-else class="p-5 text-sm text-on-surface-variant">ไม่พบออเดอร์นี้</p></main><OrderItemForm :open="itemOverlay.isOpen" :is-submitting="itemSubmitting" :error="itemError" @close="itemOverlay.close" @submit="addItem" @clear-error="clearItemError" /><OrderCaptureOverlay :open="captureOverlay.isOpen" @close="captureOverlay.close" /></AppLayout>
</template>
