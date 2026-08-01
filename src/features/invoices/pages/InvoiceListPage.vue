<script setup lang="ts">
import { watch, onMounted, onUnmounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import AppLayout from '@/layouts/AppLayout.vue'
import ListContainer from '@/shared/components/ListContainer.vue'
import { useHeaderSearch } from '@/shared/composables/useHeaderSearch'
import InvoiceFilterBar from '../components/InvoiceFilterBar.vue'
import InvoiceTable from '../components/InvoiceTable.vue'
import { useInvoiceStore } from '../stores/invoice.store'
import { useInvoiceFilterRoute } from '../composables/useInvoiceFilterRoute'
import type { InvoiceListItemDto, InvoiceStatusDto } from '../types/invoices.types'

const router = useRouter()
const invoiceStore = useInvoiceStore()
const {
  invoices,
  total,
  loading,
  error,
} = storeToRefs(invoiceStore)

const { filter, updateFilter } = useInvoiceFilterRoute()
const { searchOpen, openSearch, closeSearch } = useHeaderSearch()

const INVOICE_STATUSES: InvoiceStatusDto[] = [
  'DRAFT',
  'UNPAID',
  'OVERDUE',
  'PARTIALLY_PAID',
  'PAID',
  'CANCELLED',
  'VOID',
]

const STATUS_LABELS: Record<InvoiceStatusDto, string> = {
  DRAFT: 'Draft',
  UNPAID: 'Unpaid',
  OVERDUE: 'Overdue',
  PARTIALLY_PAID: 'Partially paid',
  PAID: 'Paid',
  CANCELLED: 'Cancelled',
  VOID: 'Void',
}

const statusFilters: Array<{ key: InvoiceStatusDto | 'all'; label: string }> = [
  { key: 'all', label: 'All' },
  ...INVOICE_STATUSES.map((status) => ({ key: status, label: STATUS_LABELS[status] })),
]

watch(
  filter,
  (newFilter) => {
    invoiceStore.fetchInvoices(newFilter)
  },
  { immediate: true },
)

// Reveal the search bar on load if a search/date filter is already active in the
// URL, so an active filter is never hidden behind a collapsed bar.
onMounted(() => {
  const { keyword, dateFrom, dateTo } = filter.value
  if (keyword || dateFrom || dateTo) openSearch()
})

onUnmounted(() => closeSearch())

function openInvoice(invoice: InvoiceListItemDto) {
  router.push({ name: 'invoice-detail', params: { invoiceNumber: invoice.invoiceNumber } })
}
</script>

<template>
  <AppLayout>
    <InvoiceFilterBar
      :filter="filter"
      :tabs="statusFilters"
      :search-open="searchOpen"
      @filter-change="updateFilter"
    />

    <main class="flex-1 overflow-y-auto no-scrollbar pb-20 w-full bg-surface min-w-0">
      <ListContainer
        title="Invoices"
        icon="receipt_long"
        :count="total"
        count-label="Invoices"
        :loading="loading"
        :error="error"
        :empty="invoices.length === 0"
        empty-text="No invoices"
        :skeleton-rows="4"
      >
        <InvoiceTable
          :invoices="invoices"
          @select="openInvoice"
        />
      </ListContainer>
    </main>
  </AppLayout>
</template>
