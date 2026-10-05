<script setup lang="ts">
import { computed } from 'vue'
import BaseDropdown from '@/shared/components/BaseDropdown.vue'
import { ORDER_LIST_DATE_FIELDS, type OrderListDateField } from '@/features/orders/composables/use-order-list-filter-route'

const props = defineProps<{
  dateField: OrderListDateField
}>()

const emit = defineEmits<{
  select: [dateField: OrderListDateField]
}>()

// Received is the default, so the trigger names the field only when another one is chosen.
const activeLabel = computed(() => (props.dateField === 'receivedDate'
  ? null
  : ORDER_LIST_DATE_FIELDS.find((option) => option.key === props.dateField)?.label ?? null))

function select(dateField: OrderListDateField, close: () => void) {
  close()
  emit('select', dateField)
}
</script>

<template>
  <BaseDropdown panel-class="w-44 rounded-2xl border border-outline-variant/30 bg-surface-container-lowest py-1 shadow-2xl">
    <template #trigger="{ open, setTrigger, toggle, triggerAttrs }">
      <button
        :ref="setTrigger"
        v-bind="triggerAttrs"
        type="button"
        class="-my-0.5 inline-flex h-8 shrink-0 items-center justify-center gap-1 rounded-full px-2 transition-colors focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime"
        :class="open || activeLabel ? 'bg-primary/10 text-primary' : 'text-primary hover:bg-primary/10 active:bg-primary/20'"
        aria-label="Filter by date"
        @click="toggle"
      >
        <span class="material-symbols-outlined text-[16px]" aria-hidden="true">tune</span>
        <span v-if="activeLabel" class="font-label text-[11px] font-bold">{{ activeLabel }}</span>
      </button>
    </template>

    <template #default="{ close }">
      <div class="py-1">
        <p class="px-3 pb-1 pt-1.5 font-label text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Date</p>
        <button
          v-for="option in ORDER_LIST_DATE_FIELDS"
          :key="option.key"
          type="button"
          class="flex w-full items-center gap-2 px-3 py-2 text-left font-body text-[12px] text-on-surface transition-colors hover:bg-surface-container-low focus:bg-surface-container-low focus:outline-none active:bg-surface-container"
          :aria-pressed="dateField === option.key"
          @click="select(option.key, close)"
        >
          <span class="material-symbols-outlined w-4 text-[16px] leading-none text-primary" aria-hidden="true">{{ dateField === option.key ? 'check' : '' }}</span>
          {{ option.label }}
        </button>
      </div>
    </template>
  </BaseDropdown>
</template>
