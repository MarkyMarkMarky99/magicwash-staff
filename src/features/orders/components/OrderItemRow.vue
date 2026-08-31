<script setup lang="ts">
import type { z } from 'zod'
import type { orderItemResponseSchema } from '@contracts/order-items/order-item-api.schema'

type OrderItem = z.infer<typeof orderItemResponseSchema>
defineProps<{ item: OrderItem; index: number }>()
</script>

<template>
  <article class="flex gap-3 px-4 py-3.5">
    <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface-container font-label text-[10px] font-bold text-primary">{{ index + 1 }}</span>
    <div class="min-w-0 flex-1">
      <p class="font-body text-sm font-semibold leading-snug text-on-surface">{{ item.description || 'ไม่ได้ระบุรายละเอียด' }}</p>
    </div>
    <div class="shrink-0 self-center text-right"><p class="font-label text-xs font-bold text-primary">{{ item.quantity ?? '—' }} <span class="text-[9px] text-on-surface-variant">pcs</span></p><p class="mt-1 font-label text-[10px] font-bold text-on-surface-variant">{{ item.price ?? '—' }}</p></div>
  </article>
</template>
