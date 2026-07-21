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

const SEARCH_DEBOUNCE_MS = 300

// Local input buffer so typing (incl. Thai IME composition) never fights the
// async route update. The URL filter stays the source of truth for fetching;
// this ref only mirrors it and pushes debounced changes up.
const keywordInput = ref(props.filter.keyword)
let debounceTimer: ReturnType<typeof setTimeout> | undefined

watch(
  () => props.filter.keyword,
  (value) => {
    if (value !== keywordInput.value) keywordInput.value = value
  },
)

watch(keywordInput, (value) => {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    if (value !== props.filter.keyword) emit('filterChange', { keyword: value })
  }, SEARCH_DEBOUNCE_MS)
})

onBeforeUnmount(() => clearTimeout(debounceTimer))

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

function clearKeyword() {
  keywordInput.value = ''
  clearTimeout(debounceTimer)
  if (props.filter.keyword) emit('filterChange', { keyword: '' })
}

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

    <!-- Search bar — toggled from the header search button -->
    <div
      v-if="searchOpen"
      class="bg-surface-container px-4 py-2 flex items-center gap-2 border-b border-outline-variant/20"
    >
      <span class="material-symbols-outlined text-on-surface-variant text-[18px] shrink-0" aria-hidden="true">search</span>
      <input
        v-model="keywordInput"
        type="text"
        placeholder="Search invoice or customer…"
        class="flex-1 bg-transparent font-body text-sm text-on-surface placeholder:text-on-surface-variant/60 outline-none min-w-0"
        autofocus
      />
      <button
        v-if="keywordInput"
        type="button"
        class="material-symbols-outlined text-on-surface-variant text-[18px] hover:text-on-surface transition-colors shrink-0"
        aria-label="Clear search"
        @click="clearKeyword"
      >close</button>

      <span class="w-px h-5 bg-outline-variant/30 shrink-0" aria-hidden="true"></span>

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
        :model-value="filter.dateFrom ?? ''"
        label="From"
        type="date"
        icon="event"
        @update:model-value="emit('filterChange', { dateFrom: $event || null })"
      />

      <FormInput
        id="invoice-date-to"
        :model-value="filter.dateTo ?? ''"
        label="To"
        type="date"
        icon="event"
        @update:model-value="emit('filterChange', { dateTo: $event || null })"
      />
    </div>
  </section>
</template>
