<script setup lang="ts">
import BaseBadge from '@/shared/components/BaseBadge.vue'
import BaseSwipeCard from '@/shared/components/BaseSwipeCard.vue'
import BaseRowCard from '@/shared/components/BaseRowCard.vue'
import CardLeadingIcon from '@/shared/components/CardLeadingIcon.vue'
import { formatSheetDate } from '@/shared/utils/sheet-date'
import { presentationFor } from '../invoice-status-presentation'
import type { InvoiceListItemDto } from '@/data/invoices/invoices.types'

const props = defineProps<{
  invoice: InvoiceListItemDto
}>()

const emit = defineEmits<{
  select: [invoiceNumber: string]
}>()

function formatMoney(value: number) {
  return `฿${Number(value).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function selectInvoice() {
  emit('select', props.invoice.invoiceNumber)
}
</script>

<template>
  <BaseSwipeCard :swipeable="false" :pressable="true" @tap="selectInvoice">
    <BaseRowCard :line1="invoice.invoiceNumber">
      <template #lead>
        <CardLeadingIcon
          :icon="presentationFor(invoice.status).icon"
          :tone="presentationFor(invoice.status).tone"
          label="Invoice"
        />
      </template>
      <template #line1>
        <span class="flex min-w-0 items-center gap-1.5">
          <span class="truncate">{{ invoice.invoiceNumber }}</span>
          <BaseBadge
            :label="presentationFor(invoice.status).label"
            size="xs"
            :uppercase="true"
            :tone="presentationFor(invoice.status).tone"
          />
          <BaseBadge
            :label="invoice.billingType === 'CYCLE' ? 'Cycle' : 'Order'"
            size="xs"
            :uppercase="true"
            tone="neutral"
          />
        </span>
      </template>
      <template #top-end>
        <span class="shrink-0 font-headline text-sm font-bold text-primary">
          {{ formatMoney(invoice.grandTotal) }}
        </span>
      </template>
      <template #line2>
        <template v-if="invoice.customer?.customerName || invoice.customer?.phone">
          <template v-if="invoice.customer?.customerName">{{ invoice.customer.customerName }}</template>
          <template v-if="invoice.customer?.customerName && invoice.customer?.phone"> · </template>
          <template v-if="invoice.customer?.phone">{{ invoice.customer.phone }}</template>
        </template>
        <template v-else>{{ invoice.customerId }}</template>
      </template>
      <template #line3>
        Issued {{ invoice.issuedDate ? formatSheetDate(invoice.issuedDate) : '—' }} · Due
        <span :class="invoice.status === 'OVERDUE' ? 'text-error' : ''">{{ invoice.dueDate ? formatSheetDate(invoice.dueDate) : '—' }}</span>
      </template>
      <template #bot-end>
        <span
          v-if="invoice.paidAmount > 0 && invoice.balanceDue > 0"
          class="shrink-0 font-body text-xs text-on-surface-variant"
        >
          Paid {{ formatMoney(invoice.paidAmount) }} · {{ formatMoney(invoice.balanceDue) }} left
        </span>
      </template>
    </BaseRowCard>
  </BaseSwipeCard>
</template>
