<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import ListContainer from '@/shared/components/ListContainer.vue'
import InvoiceCard from '@/features/invoices/components/InvoiceCard.vue'
import { useCustomerInvoicesStore } from '../stores/customer-invoices.store'

defineProps<{ customerId: string }>()
const router = useRouter()
const { invoices, loading, error } = storeToRefs(useCustomerInvoicesStore())
</script>

<template>
  <ListContainer
    title="Invoices" icon="receipt_long" :count="invoices.length" count-label="invoices"
    :loading="loading" :error="error" :empty="invoices.length === 0" empty-text="No invoices" :skeleton-rows="4"
  >
    <InvoiceCard
      v-for="invoice in invoices" :key="invoice.invoiceNumber" :invoice="invoice"
      @select="router.push({ name: 'invoice-detail', params: { invoiceNumber: $event } })"
    />
  </ListContainer>
</template>
