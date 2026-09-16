<script setup lang="ts">
import type { z } from 'zod'
import type { orderItemResponseSchema } from '@contracts/order-items/order-item-api.schema'

type OrderItem = z.infer<typeof orderItemResponseSchema>
const props = defineProps<{ item: OrderItem; index: number }>()

const emit = defineEmits<{
  select: [orderItemId: string, itemId: string | null]
}>()

function selectItem(): void {
  emit('select', props.item.orderItemId, props.item.itemId)
}
</script>

<template>
  <article
    class="flex cursor-pointer items-center gap-3 px-4 py-2 transition-colors hover:bg-surface-container-low active:bg-surface-container focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
    role="button"
    tabindex="0"
    :aria-label="`Open garment album${item.description ? ` ${item.description}` : ` item ${index + 1}`}`"
    @click="selectItem"
    @keydown.enter="selectItem"
    @keydown.space.prevent="selectItem"
  >
    <div class="min-w-0 flex-1">
      <p class="truncate font-body text-sm font-medium leading-tight text-on-surface">{{ item.description || 'No description' }}</p>
    </div>
    <span class="shrink-0 font-label text-[11px] font-semibold text-on-surface-variant">{{ item.quantity ?? '—' }} pcs</span>
  </article>
</template>
