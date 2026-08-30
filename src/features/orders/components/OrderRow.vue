<script setup lang="ts">
import type { z } from 'zod'
import type { workOrderListResponseSchema } from '@contracts/work-orders/work-order-api.schema'
import { formatSheetDate } from '@/shared/utils/sheet-date'
import { getOrderServiceTypeLabel, getOrderStatusLabel } from '@/features/orders/order-status-labels'

type Order = z.infer<typeof workOrderListResponseSchema>

defineProps<{ order: Order }>()
const emit = defineEmits<{ select: [orderId: string] }>()

</script>

<template>
  <button type="button" class="group flex w-full items-stretch gap-3 px-4 py-3.5 text-left transition-colors hover:bg-surface-container-low focus:outline-none focus-visible:bg-surface-container-low" @click="emit('select', order.orderId)">
    <div class="flex w-10 shrink-0 flex-col items-center justify-center rounded-xl bg-primary text-on-primary shadow-sm">
      <span class="material-symbols-outlined text-[19px]" aria-hidden="true">local_laundry_service</span>
      <span class="mt-0.5 font-label text-[8px] font-bold tracking-wide">ORDER</span>
    </div>
    <div class="min-w-0 flex-1">
      <div class="flex items-start justify-between gap-2">
        <p class="truncate font-headline text-sm font-bold text-on-surface">{{ order.customerName?.trim() ? order.customerName : order.customerId }}</p>
        <div class="flex shrink-0 items-center gap-1">
          <span v-if="getOrderServiceTypeLabel(order.serviceType)" class="shrink-0 rounded-full bg-secondary-container px-2 py-0.5 font-label text-[9px] font-bold uppercase tracking-wide text-on-secondary-container">{{ getOrderServiceTypeLabel(order.serviceType) }}</span>
          <span v-if="getOrderStatusLabel(order.status)" class="shrink-0 rounded-full bg-secondary-container px-2 py-0.5 font-label text-[9px] font-bold uppercase tracking-wide text-on-secondary-container">{{ getOrderStatusLabel(order.status) }}</span>
        </div>
      </div>
      <p class="mt-0.5 truncate font-body text-xs text-on-surface-variant">{{ formatSheetDate(order.receivedDate) }} <span aria-hidden="true">→</span> {{ formatSheetDate(order.dueDate) }}</p>
      <div class="mt-2 flex items-center gap-2 font-label text-[10px] text-on-surface-variant">
        <span v-if="order.quantity !== null" class="font-bold text-on-surface-variant">{{ order.quantity }} ชิ้น</span>
        <span v-if="order.invoiceNumber !== null" class="rounded-full bg-tertiary-container px-1.5 py-0.5 font-bold text-on-tertiary-container">{{ order.invoiceNumber }}</span>
      </div>
    </div>
    <span class="material-symbols-outlined self-center text-[18px] text-outline transition-transform group-hover:translate-x-0.5" aria-hidden="true">chevron_right</span>
  </button>
</template>
