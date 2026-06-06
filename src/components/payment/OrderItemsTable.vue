<script setup>
import SectionContainer from '../shared/SectionContainer.vue'

defineProps({
  items: {
    type: Array,
    default: () => [],
  },
  formatCurrency: {
    type: Function,
    required: true,
  },
})
</script>

<template>
  <SectionContainer
    title="Order Items"
    icon="shopping_basket"
    :count="items.length"
    count-label="Items"
  >
    <div v-if="items.length" class="divide-y divide-outline-variant/15">
      <div
        v-for="item in items"
        :key="item.id"
        class="grid grid-cols-[auto_1fr_auto] items-start gap-3 px-4 py-3"
      >
        <div class="w-7 h-7 rounded bg-surface-container text-on-surface-variant flex items-center justify-center text-xs font-bold">
          {{ item.qty }}
        </div>
        <div class="min-w-0">
          <p class="text-sm font-semibold text-on-surface leading-snug truncate">{{ item.name }}</p>
          <p class="text-xs text-on-surface-variant mt-0.5">{{ formatCurrency(item.price) }} / Unit</p>
        </div>
        <p class="text-sm font-bold text-on-surface whitespace-nowrap">
          {{ formatCurrency(item.price * item.qty) }}
        </p>
      </div>
    </div>

    <div v-else class="px-4 py-8 text-center text-sm text-on-surface-variant">
      No order items
    </div>
  </SectionContainer>
</template>
