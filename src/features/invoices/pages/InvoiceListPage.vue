<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import ListPageLayout from '@/shared/layouts/ListPageLayout.vue'
import ListContainer from '@/shared/components/ListContainer.vue'
import InvoiceDateFilter from '../components/InvoiceDateFilter.vue'
import InvoiceDatePanel from '../components/InvoiceDatePanel.vue'
import InvoiceFilterBar from '../components/InvoiceFilterBar.vue'
import InvoiceCard from '../components/InvoiceCard.vue'
import { useInvoiceStore } from '../stores/invoice.store'
import { useInvoiceFilterRoute } from '../composables/useInvoiceFilterRoute'
import type { InvoiceStatusDto } from '../types/invoices.types'

const router = useRouter()
const invoiceStore = useInvoiceStore()
const {
  invoices,
  total,
  loading,
  error,
} = storeToRefs(invoiceStore)

const { filter, updateFilter } = useInvoiceFilterRoute()
const dateFilterOpen = ref(false)

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

onMounted(() => {
  if (filter.value.dateFrom || filter.value.dateTo) dateFilterOpen.value = true
})

function openInvoice(invoiceNumber: string) {
  router.push({ name: 'invoice-detail', params: { invoiceNumber } })
}
</script>

<template>
  <ListPageLayout>
    <template #filters>
      <InvoiceFilterBar
        :filter="filter"
        :tabs="statusFilters"
        @filter-change="updateFilter"
      />
    </template>

    <ListContainer
      title="Invoices"
      icon="receipt_long"
      :count="total"
      count-label="Invoices"
      searchable
      :search-value="filter.keyword"
      search-placeholder="Search invoice number or customer ID…"
      @update:search-value="updateFilter({ keyword: $event })"
      :loading="loading"
      :error="error"
      :empty="invoices.length === 0"
      empty-text="No invoices"
      :skeleton-rows="4"
    >
      <template #search-actions>
        <InvoiceDateFilter v-model:open="dateFilterOpen" :filter="filter" :disabled="loading" />
      </template>

      <template #empty>
        <InvoiceDatePanel v-if="dateFilterOpen" :filter="filter" @filter-change="updateFilter" />
        <p class="px-6 py-4 font-body text-sm italic text-on-surface-variant">No invoices</p>
      </template>

      <template #error>
        <InvoiceDatePanel v-if="dateFilterOpen" :filter="filter" @filter-change="updateFilter" />
        <p class="px-6 py-4 font-body text-sm text-error">{{ error }}</p>
      </template>

      <InvoiceDatePanel v-if="dateFilterOpen" :filter="filter" @filter-change="updateFilter" />

      <InvoiceCard
        v-for="invoice in invoices"
        :key="invoice.invoiceNumber"
        :invoice="invoice"
        @select="openInvoice"
      />
    </ListContainer>
  </ListPageLayout>
</template>
