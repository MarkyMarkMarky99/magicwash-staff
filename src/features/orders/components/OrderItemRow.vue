<script setup lang="ts">
import type { z } from 'zod'
import type { orderItemResponseSchema } from '@contracts/order-items/order-item-api.schema'
import BaseDropdown from '@/shared/components/BaseDropdown.vue'

type OrderItem = z.infer<typeof orderItemResponseSchema>
const props = defineProps<{ item: OrderItem; index: number }>()

const emit = defineEmits<{
  select: [orderItemId: string, itemId: string | null]
  register: [orderItemId: string]
}>()

function selectItem(): void {
  emit('select', props.item.orderItemId, props.item.itemId)
}
</script>

<template>
  <div class="relative">
  <article
    class="flex cursor-pointer items-center gap-3 py-2 pl-4 pr-14 transition-colors hover:bg-surface-container-low active:bg-surface-container focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
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
  <BaseDropdown panel-class="w-52 rounded-2xl border border-outline-variant/30 bg-surface-container-lowest py-1 shadow-2xl">
    <template #trigger="{ setTrigger, toggle, triggerAttrs }">
      <button :ref="setTrigger" v-bind="triggerAttrs" type="button" class="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-primary" :aria-label="`Actions for item ${index + 1}`" @click.stop="toggle">
        <span class="material-symbols-outlined" aria-hidden="true">more_vert</span>
      </button>
    </template>
    <template #default="{ close }">
      <button type="button" class="w-full px-3 py-3 text-left font-body text-sm text-on-surface hover:bg-surface-container-low" @click="close(); emit('register', item.orderItemId)">Register photo and tag</button>
    </template>
  </BaseDropdown>
  </div>
</template>
