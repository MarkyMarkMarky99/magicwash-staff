<script setup lang="ts">
import type { z } from 'zod'
import type { workOrderListResponseSchema } from '@contracts/work-orders/work-order-api.schema'
import { formatSheetDate } from '@/shared/utils/sheet-date'

type Order = z.infer<typeof workOrderListResponseSchema>

defineProps<{ order: Order; customerName?: string | null }>()
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
        <p class="truncate font-headline text-sm font-bold text-on-surface">{{ order.orderNumber ?? order.orderId }}</p>
        <span v-if="order.status" class="shrink-0 rounded-full bg-secondary-container px-2 py-0.5 font-label text-[9px] font-bold uppercase tracking-wide text-on-secondary-container">{{ order.status }}</span>
      </div>
      <p class="mt-0.5 truncate font-body text-xs text-on-surface-variant">{{ customerName ?? order.customerId }}</p>
      <div class="mt-2 flex items-center gap-2 font-label text-[10px] text-on-surface-variant">
        <span>{{ formatSheetDate(order.receivedDate) }}</span><span aria-hidden="true">→</span><span>{{ formatSheetDate(order.dueDate) }}</span>
        <span class="ml-auto rounded bg-surface-container px-1.5 py-0.5 font-bold text-primary">{{ order.serviceType ?? '—' }}</span>
      </div>
    </div>
    <span class="material-symbols-outlined self-center text-[18px] text-outline transition-transform group-hover:translate-x-0.5" aria-hidden="true">chevron_right</span>
  </button>
</template>
