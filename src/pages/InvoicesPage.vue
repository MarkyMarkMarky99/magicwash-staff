<script setup>
import { computed, ref } from 'vue'
import AppLayout from '../layouts/AppLayout.vue'
import GenericTabs from '../components/shared/GenericTabs.vue'
import InvoiceCard from '../components/invoices/InvoiceCard.vue'

const selectedStatus = ref('all')

const STATUS_TONES = {
  draft: {
    icon: 'edit_document',
    label: 'Draft',
    avatar: 'bg-gray-100 text-gray-500',
    badge: 'bg-gray-100 text-gray-600',
  },
  unpaid: {
    icon: 'receipt_long',
    label: 'Unpaid',
    avatar: 'bg-amber-50 text-amber-700',
    badge: 'bg-amber-100 text-amber-700',
  },
  paid: {
    icon: 'task_alt',
    label: 'Paid',
    avatar: 'bg-green-50 text-green-700',
    badge: 'bg-green-100 text-green-700',
  },
  overdue: {
    icon: 'warning',
    label: 'Overdue',
    avatar: 'bg-red-50 text-red-700',
    badge: 'bg-red-100 text-red-700',
  },
}

const invoiceStatuses = [
  { key: 'all', label: 'All' },
  { key: 'draft', label: 'Draft' },
  { key: 'unpaid', label: 'Unpaid' },
  { key: 'paid', label: 'Paid' },
  { key: 'overdue', label: 'Overdue' },
]

const invoices = ref([
  {
    id: 'inv-1008',
    invoiceNo: 'INV-2026-1008',
    customer: 'Anong Laundry Co.',
    dueDate: '2026-06-12',
    total: 1840,
    status: 'unpaid',
    paymentMethod: 'Transfer',
    itemsSummary: 'Wash & Fold · 24 items',
  },
  {
    id: 'inv-1007',
    invoiceNo: 'INV-2026-1007',
    customer: 'Somsak Residence',
    dueDate: '2026-06-10',
    total: 620,
    status: 'draft',
    paymentMethod: 'COD',
    itemsSummary: 'Dry Cleaning · 3 items',
  },
  {
    id: 'inv-1006',
    invoiceNo: 'INV-2026-1006',
    customer: 'Baan Sukhumvit',
    dueDate: '2026-06-05',
    total: 2320,
    status: 'overdue',
    paymentMethod: 'Transfer',
    itemsSummary: 'Monthly account · 48 items',
  },
  {
    id: 'inv-1005',
    invoiceNo: 'INV-2026-1005',
    customer: 'Nara Boutique Hotel',
    dueDate: '2026-06-04',
    total: 4280,
    status: 'paid',
    paymentMethod: 'Credit',
    itemsSummary: 'Corporate laundry · 86 items',
  },
])

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

const displayInvoices = computed(() =>
  filteredInvoices.value.map(invoice => {
    const tone = STATUS_TONES[invoice.status] || STATUS_TONES.draft
    return {
      ...invoice,
      statusLabel: tone.label,
      statusTone: tone,
    }
  })
)
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
      <section class="bg-white w-full">
        <div class="px-4 py-2 bg-surface-container-low text-primary flex items-center justify-between">
          <div class="flex items-center gap-2.5">
            <span class="material-symbols-outlined text-primary text-[16px]">receipt_long</span>
            <h2 class="font-headline font-bold text-[13px] tracking-tight">Invoices</h2>
          </div>
          <div class="flex items-center gap-1.5 bg-surface-container rounded-full px-2.5 py-1">
            <span class="font-label text-[9px] text-on-surface-variant font-bold uppercase tracking-wider">
              {{ filteredInvoices.length }} Invoices
            </span>
          </div>
        </div>

        <p
          v-if="filteredInvoices.length === 0"
          class="px-6 py-4 text-sm text-on-surface-variant italic"
        >
          No invoices
        </p>

        <div v-else class="divide-y divide-outline-variant/10">
          <InvoiceCard
            v-for="invoice in displayInvoices"
            :key="invoice.id"
            :invoice="invoice"
          />
        </div>
      </section>
    </main>
  </AppLayout>
</template>
