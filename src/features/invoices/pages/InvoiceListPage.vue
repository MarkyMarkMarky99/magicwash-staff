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
import type { InvoiceResponseDto, InvoiceStatusDto } from '../types/invoices.types'

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

const INVOICE_STATUSES = ['UNPAID', 'PARTIAL', 'PAID', 'OVERDUE'] as const

const STATUS_LABELS: Record<InvoiceStatusDto, string> = {
  UNPAID: 'Unpaid',
  PARTIAL: 'Partial',
  PAID: 'Paid',
  OVERDUE: 'Overdue',
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

function openInvoice(invoice: InvoiceResponseDto) {
  router.push({ name: 'invoice-detail', params: { invoiceId: invoice.id } })
}

function openCreateInvoice() {
  router.push({ name: 'invoice-create' })
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
        <template #actions>
          <button
            type="button"
            class="w-7 h-7 rounded-full bg-primary text-on-primary flex items-center justify-center"
            aria-label="Create invoice"
            @click.stop="openCreateInvoice"
          >
            <span class="material-symbols-outlined text-[18px]" aria-hidden="true">add</span>
          </button>
        </template>

        <InvoiceTable
          :invoices="invoices"
          @select="openInvoice"
        />
      </ListContainer>
    </main>
  </AppLayout>
</template>
