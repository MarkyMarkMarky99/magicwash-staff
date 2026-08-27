<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import GenericTabs from '@/shared/components/GenericTabs.vue'
import FormInput from '@/shared/components/FormInput.vue'
import type { InvoiceFilter } from '../types/invoice-filter.types'
import type { InvoiceStatusDto } from '../types/invoices.types'

interface FilterTab {
  key: string
  label: string
  count?: number
}

const props = defineProps<{
  filter: InvoiceFilter
  tabs: FilterTab[]
  searchOpen: boolean
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

// Filter dropdown (date range) — local UI state, collapsed by default and
// reset whenever the search bar is hidden.
const filterOpen = ref(false)
const hasDateFilter = computed(() => Boolean(props.filter.dateFrom || props.filter.dateTo))

watch(
  () => props.searchOpen,
  (open) => {
    if (!open) filterOpen.value = false
  },
)

function updateStatus(status: string) {
  emit('filterChange', {
    status: status === 'all' ? null : (status as InvoiceStatusDto),
  })
}
</script>

<template>
  <section class="shrink-0 bg-white border-b border-outline-variant/20">
    <div class="bg-primary text-on-primary">
      <GenericTabs
        :tabs="tabs"
        :active-key="filter.status ?? 'all'"
        @select="updateStatus"
      />
    </div>

    <div
      v-if="searchOpen"
      class="bg-surface-container px-4 py-2 flex items-center justify-end border-b border-outline-variant/20"
    >
      <!-- Filter action button (date range) -->
      <button
        type="button"
        class="material-symbols-outlined text-[18px] transition-colors shrink-0 rounded-full p-0.5"
        :class="filterOpen || hasDateFilter ? 'text-primary' : 'text-on-surface-variant hover:text-on-surface'"
        :aria-label="filterOpen ? 'Hide filters' : 'Show filters'"
        :aria-expanded="filterOpen"
        @click="filterOpen = !filterOpen"
      >tune</button>
    </div>

    <!-- Filter dropdown -->
    <div
      v-if="searchOpen && filterOpen"
      class="bg-surface-container-lowest px-4 py-3 border-b border-outline-variant/20 grid gap-3 md:grid-cols-2"
    >
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
  </section>
</template>
