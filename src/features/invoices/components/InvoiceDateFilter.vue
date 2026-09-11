<script setup lang="ts">
import { computed } from 'vue'
import type { InvoiceFilter } from '../types/invoice-filter.types'

const props = defineProps<{
  filter: InvoiceFilter
  open: boolean
  // Keep this control disabled while ListContainer suppresses its panel slots during loading.
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const hasDateFilter = computed(() => Boolean(props.filter.dateFrom || props.filter.dateTo))
</script>

<template>
  <button
    type="button"
    class="-my-0.5 inline-flex h-8 shrink-0 items-center justify-center rounded-full px-2 transition-colors focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    :class="props.open || hasDateFilter
      ? 'bg-primary/10 text-primary'
      : 'text-primary hover:bg-primary/10 active:bg-primary/20'"
    :aria-label="props.open ? 'Hide date filter' : 'Filter by date'"
    :aria-expanded="props.open"
    :disabled="props.disabled"
    @click="emit('update:open', !props.open)"
  >
    <span class="material-symbols-outlined text-[16px]" aria-hidden="true">tune</span>
  </button>
</template>
