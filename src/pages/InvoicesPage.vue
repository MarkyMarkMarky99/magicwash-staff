<script setup>
import { computed, onMounted, ref } from 'vue'
import AppLayout from '../layouts/AppLayout.vue'
import GenericTabs from '../components/shared/GenericTabs.vue'
import ListContainer from '../components/shared/ListContainer.vue'
import InvoiceCard from '../components/invoices/InvoiceCard.vue'
import { getInvoices } from '../features/invoices/services/invoice.service'

const selectedStatus = ref('all')
const invoices = ref([])
const loading = ref(false)
const error = ref(null)

const invoiceStatuses = [
  { key: 'all', label: 'All' },
  { key: 'UNPAID', label: 'Unpaid' },
  { key: 'PARTIAL', label: 'Partial' },
  { key: 'PAID', label: 'Paid' },
  { key: 'OVERDUE', label: 'Overdue' },
]

const filteredInvoices = computed(() => {
  if (selectedStatus.value === 'all') return invoices.value
  return invoices.value.filter(invoice => invoice.status === selectedStatus.value)
})

const tabs = computed(() =>
  invoiceStatuses.map(status => ({
    ...status,
    count: status.key === 'all'
      ? invoices.value.length
      : invoices.value.filter(invoice => invoice.status === status.key).length,
  }))
)

onMounted(async () => {
  loading.value = true
  error.value = null

  try {
    const result = await getInvoices({
      keyword: '',
      customerId: null,
      status: null,
      dateFrom: null,
      dateTo: null,
      page: 1,
      perPage: 20,
      sortBy: 'issuedDate',
      sortOrder: 'desc',
    })

    invoices.value = result.invoices
  } catch {
    error.value = 'Unable to load invoices'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <AppLayout>
    <div class="flex-none bg-primary text-on-primary w-full min-w-0">
      <GenericTabs
        :tabs="tabs"
        :active-key="selectedStatus"
        @select="selectedStatus = $event"
      />
    </div>

    <main class="flex-1 overflow-y-auto no-scrollbar pb-20 w-full bg-surface min-w-0">
      <ListContainer
        title="Invoices"
        icon="receipt_long"
        :count="filteredInvoices.length"
        count-label="Invoices"
        :loading="loading"
        :error="error"
        :empty="filteredInvoices.length === 0"
        empty-text="No invoices"
      >
        <InvoiceCard
          v-for="invoice in filteredInvoices"
          :key="invoice.id"
          :invoice="invoice"
        />
      </ListContainer>
    </main>
  </AppLayout>
</template>
