<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import ListContainer from '@/shared/components/ListContainer.vue'
import CreateDropdownMenu from './CreateDropdownMenu.vue'
import CustomerRecordCard from './CustomerRecordCard.vue'
import { formatSheetDate } from '@/shared/utils/sheet-date'
import { invoiceStatusPresentation } from '../utils/customer-invoice-status-presentation'
import { useCustomerInvoicesStore } from '@/data/invoices/customer-invoices.store'
import { useCustomerOrderHistoryStore } from '../stores/customer-order-history.store'
import { invoiceCreateRoute } from '@/shared/navigation/form-routes'

const props = defineProps<{ customerId: string }>()
const router = useRouter()
const { invoices, loading, error } = storeToRefs(useCustomerInvoicesStore())
const { orders } = storeToRefs(useCustomerOrderHistoryStore())
const invoiceOrders = computed(() => orders.value.filter((order) =>
  order.customerId === props.customerId && Boolean(order.orderId?.trim()),
))
const createItems = computed(() => invoiceOrders.value.length
  ? invoiceOrders.value.map((order) => ({ key: order.orderId, label: order.orderId }))
  : [{ key: 'none', label: 'No orders to invoice', disabled: true }])

function createInvoice(orderId: string) {
  if (!invoiceOrders.value.some((order) => order.orderId === orderId)) return
  router.push(invoiceCreateRoute({ customerId: props.customerId, orderId }))
}

function formatMoney(value: number) {
  return `฿${Number(value).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}
</script>

<template>
  <ListContainer
    title="Invoices" icon="receipt_long" count-label="invoices"
    :loading="loading" :error="error" :empty="invoices.length === 0" empty-text="No invoices" :skeleton-rows="4"
  >
    <template #actions>
      <CreateDropdownMenu :label="`${invoices.length} invoices`" aria-label="Create invoice" :items="createItems" @select="createInvoice" />
    </template>
    <CustomerRecordCard
      v-for="invoice in invoices"
      :key="invoice.invoiceNumber"
      :icon="invoiceStatusPresentation(invoice.status).icon"
      :tone="invoiceStatusPresentation(invoice.status).tone"
      icon-label="Invoice"
      :title="invoice.invoiceNumber"
      :badges="[
        { label: invoiceStatusPresentation(invoice.status).label, tone: invoiceStatusPresentation(invoice.status).tone },
        { label: invoice.billingType === 'CYCLE' ? 'Cycle' : 'Order', tone: 'neutral' },
      ]"
      :trailing="formatMoney(invoice.grandTotal)"
      trailing-emphasis
      :detail="`Issued ${invoice.issuedDate ? formatSheetDate(invoice.issuedDate) : '—'} · Due ${invoice.dueDate ? formatSheetDate(invoice.dueDate) : '—'}`"
      :meta="invoice.paidAmount > 0 && invoice.balanceDue > 0 ? `Paid ${formatMoney(invoice.paidAmount)} · ${formatMoney(invoice.balanceDue)} left` : undefined"
      @select="router.push({ name: 'invoice-detail', params: { invoiceNumber: invoice.invoiceNumber } })"
    />
  </ListContainer>
</template>
