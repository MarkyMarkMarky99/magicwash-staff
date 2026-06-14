<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted, onBeforeUnmount } from 'vue'
import { storeToRefs } from 'pinia'
import { customerTypeSchema } from '@contracts/customers/customer-api.schema'
import AppLayout from '@/layouts/AppLayout.vue'
import ListContainer from '@/shared/components/ListContainer.vue'
import { useHeaderSearch } from '@/shared/composables/useHeaderSearch'
import CustomerTypeTabs from '../components/CustomerTypeTabs.vue'
import CustomerCard from '../components/CustomerCard.vue'
import { useCustomerStore } from '../stores/customer.store'
import { useCustomerFilterRoute } from '../composables/useCustomerFilterRoute'

const customerStore = useCustomerStore()
const { customers, loading, error } = storeToRefs(customerStore)

const { filter, updateFilter } = useCustomerFilterRoute()
const { searchOpen, openSearch, closeSearch } = useHeaderSearch()

// Type-tab counts: a trivial count over the full list (every customer is loaded),
// so each tab shows the true total per type, independent of the active search.
const typeCounts = computed<Record<string, number>>(() => {
  const counts: Record<string, number> = { all: customers.value.length }
  for (const type of customerTypeSchema.options) {
    counts[type] = customers.value.filter((c) => c.customerType === type).length
  }
  return counts
})

// Search + type filter applied to the in-memory list — no re-fetch.
const filteredCustomers = computed(() => {
  let list = customers.value

  const type = filter.value.customerType
  if (type) list = list.filter((c) => c.customerType === type)

  const q = filter.value.keyword.trim().toLowerCase()
  if (q) {
    list = list.filter(
      (c) =>
        (c.customerIndex ?? '').toLowerCase().includes(q) ||
        (c.customerName ?? '').toLowerCase().includes(q) ||
        (c.phone ?? '').toLowerCase().includes(q) ||
        (c.address ?? '').toLowerCase().includes(q),
    )
  }

  return list
})

const activeType = computed(() => filter.value.customerType ?? 'all')

function selectType(key: string) {
  updateFilter({ customerType: key === 'all' ? null : (key as typeof filter.value.customerType) })
}

// Local search buffer mirrors the URL keyword and pushes debounced changes up,
// so typing (incl. Thai IME composition) never fights the async route update.
const SEARCH_DEBOUNCE_MS = 250
const keywordInput = ref(filter.value.keyword)
let debounceTimer: ReturnType<typeof setTimeout> | undefined

watch(
  () => filter.value.keyword,
  (value) => {
    if (value !== keywordInput.value) keywordInput.value = value
  },
)

watch(keywordInput, (value) => {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    if (value !== filter.value.keyword) updateFilter({ keyword: value })
  }, SEARCH_DEBOUNCE_MS)
})

function clearKeyword() {
  keywordInput.value = ''
  clearTimeout(debounceTimer)
  if (filter.value.keyword) updateFilter({ keyword: '' })
}

onMounted(() => {
  customerStore.loadCustomers()
  // Reveal the search bar if a keyword is already active in the URL, so an active
  // filter is never hidden behind a collapsed bar.
  if (filter.value.keyword) openSearch()
})

onBeforeUnmount(() => clearTimeout(debounceTimer))
onUnmounted(() => closeSearch())
</script>

<template>
  <AppLayout>
    <!-- Type tabs -->
    <div class="flex-none bg-primary text-on-primary w-full min-w-0">
      <CustomerTypeTabs :active-type="activeType" :counts="typeCounts" @select="selectType" />
    </div>

    <!-- Search bar — toggled from the header search button -->
    <div
      v-if="searchOpen"
      class="flex-none bg-surface-container px-4 py-2 flex items-center gap-2 border-b border-outline-variant/20"
    >
      <span class="material-symbols-outlined text-on-surface-variant text-[18px] shrink-0" aria-hidden="true">search</span>
      <input
        v-model="keywordInput"
        type="text"
        placeholder="Search by index, name, phone, or address…"
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
    </div>

    <!-- Main content -->
    <main class="flex-1 overflow-y-auto no-scrollbar pb-20 w-full bg-surface min-w-0">
      <ListContainer
        title="Customers"
        icon="group"
        :count="filteredCustomers.length"
        count-label="Customers"
        :loading="loading"
        :error="error"
        :empty="filteredCustomers.length === 0"
        empty-text="No customers"
        :skeleton-rows="4"
      >
        <CustomerCard
          v-for="c in filteredCustomers"
          :key="c.customerId"
          :customer="c"
        />
      </ListContainer>
    </main>
  </AppLayout>
</template>
