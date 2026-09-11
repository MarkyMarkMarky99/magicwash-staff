<script setup lang="ts">
import { ref, watch, onBeforeUnmount } from 'vue'
import FormInput from '@/shared/components/FormInput.vue'
import type { InvoiceFilter } from '../types/invoice-filter.types'

const props = defineProps<{
  filter: InvoiceFilter
}>()

const emit = defineEmits<{
  filterChange: [payload: Partial<InvoiceFilter>]
}>()

// Date inputs use local buffers + debouncing because a native <input type="date">
// fires one change per keystroke while typing.
const DATE_DEBOUNCE_MS = 300

const dateFromInput = ref(props.filter.dateFrom ?? '')
const dateToInput = ref(props.filter.dateTo ?? '')
let dateFromTimer: ReturnType<typeof setTimeout> | undefined
let dateToTimer: ReturnType<typeof setTimeout> | undefined

watch(
  () => props.filter.dateFrom,
  (value) => {
    const normalized = value ?? ''
    if (normalized !== dateFromInput.value) dateFromInput.value = normalized
  },
)

watch(
  () => props.filter.dateTo,
  (value) => {
    const normalized = value ?? ''
    if (normalized !== dateToInput.value) dateToInput.value = normalized
  },
)

watch(dateFromInput, (value) => {
  clearTimeout(dateFromTimer)
  dateFromTimer = setTimeout(() => {
    const normalized = value || null
    if (normalized !== props.filter.dateFrom) emit('filterChange', { dateFrom: normalized })
  }, DATE_DEBOUNCE_MS)
})

watch(dateToInput, (value) => {
  clearTimeout(dateToTimer)
  dateToTimer = setTimeout(() => {
    const normalized = value || null
    if (normalized !== props.filter.dateTo) emit('filterChange', { dateTo: normalized })
  }, DATE_DEBOUNCE_MS)
})

onBeforeUnmount(() => {
  clearTimeout(dateFromTimer)
  clearTimeout(dateToTimer)
})
</script>

<template>
  <!-- Rendered into ListContainer's default, empty and error slots so the filter stays clearable. -->
  <div class="grid gap-3 bg-surface-container-lowest px-4 py-3 md:grid-cols-2">
    <FormInput
      id="invoice-date-from"
      :model-value="dateFromInput"
      label="From"
      type="date"
      icon="event"
      @update:model-value="dateFromInput = $event"
    />

    <FormInput
      id="invoice-date-to"
      :model-value="dateToInput"
      label="To"
      type="date"
      icon="event"
      @update:model-value="dateToInput = $event"
    />
  </div>
</template>
