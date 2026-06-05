<script setup>
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
  <section class="bg-surface-container-lowest border border-outline-variant/25 rounded-lg overflow-hidden">
    <div class="px-4 py-3 bg-surface-container-low border-b border-outline-variant/20 flex items-center justify-between">
      <h2 class="font-headline font-bold text-sm text-primary flex items-center gap-2">
        <span class="material-symbols-outlined text-[20px]">shopping_basket</span>
        Order Items
      </h2>
      <span class="text-[11px] text-on-surface-variant font-semibold bg-surface-container-lowest px-2 py-1 rounded border border-outline-variant/20">
        {{ items.length }} Items
      </span>
    </div>

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
  </section>
</template>
