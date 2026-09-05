<script setup lang="ts">
import { computed } from 'vue'
import type { CustomerPackageFilter } from '../composables/useCustomerPackageFilterRoute'

const props = defineProps<{
  filter: CustomerPackageFilter
  open: boolean
  // ListContainer renders none of the panel's slots while loading, so opening it would flip
  // aria-expanded on nothing.
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const hasExtraFilter = computed(() => Boolean(props.filter.customerId || props.filter.packageCode))
</script>

<template>
  <!-- The trigger sits in the ListContainer header next to the create button, the same place the
       price-list keeps its filter, so extra filters never cost a strip of their own. -->
  <button
    type="button"
    class="-my-0.5 inline-flex h-8 shrink-0 items-center justify-center gap-1 rounded-full px-2 transition-colors focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    :class="props.open || hasExtraFilter
      ? 'bg-primary/10 text-primary'
      : 'text-primary hover:bg-primary/10 active:bg-primary/20'"
    :aria-label="props.open ? 'Hide filters' : 'Show filters'"
    :aria-expanded="props.open"
    :disabled="props.disabled"
    @click="emit('update:open', !props.open)"
  >
    <span class="material-symbols-outlined text-[16px]" aria-hidden="true">tune</span>
    <span v-if="hasExtraFilter" class="font-label text-[11px] font-bold">1</span>
  </button>
</template>
