<script setup lang="ts">
import type { z } from 'zod'
import type { orderItemSchema } from '@contracts/orders/order-api.schema'

type OrderItem = z.infer<typeof orderItemSchema>
defineProps<{ item: OrderItem; index: number }>()
</script>

<template>
  <article class="flex gap-3 px-4 py-3.5">
    <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface-container font-label text-[10px] font-bold text-primary">{{ index + 1 }}</span>
    <div class="min-w-0 flex-1">
      <p class="font-body text-sm font-semibold leading-snug text-on-surface">{{ item.description || 'ไม่ได้ระบุรายละเอียด' }}</p>
      <p class="mt-1 font-label text-[10px] font-bold tracking-wide text-on-surface-variant">{{ item.serviceType || 'ไม่ระบุบริการ' }}</p>
    </div>
    <p class="shrink-0 self-center font-label text-xs font-bold text-primary">{{ item.quantity ?? '—' }} <span class="text-[9px] text-on-surface-variant">pcs</span></p>
  </article>
</template>
