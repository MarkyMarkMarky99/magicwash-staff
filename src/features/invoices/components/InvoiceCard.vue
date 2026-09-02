<script setup lang="ts">
import BaseBadge from '@/shared/components/BaseBadge.vue'
import CardLeadingIcon from '@/shared/components/CardLeadingIcon.vue'
import { formatSheetDate } from '@/shared/utils/sheet-date'
import { presentationFor } from '../invoice-status-presentation'
import type { InvoiceListItemDto } from '../types/invoices.types'

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
  <article
    class="flex cursor-pointer gap-3 px-4 py-3 transition-colors hover:bg-surface-container-low active:bg-surface-container"
    role="button"
    tabindex="0"
    @click="selectInvoice"
    @keydown.enter="selectInvoice"
    @keydown.space.prevent="selectInvoice"
  >
    <CardLeadingIcon
      :icon="presentationFor(invoice.status).icon"
      :tone="presentationFor(invoice.status).tone"
      label="Invoice"
    />

    <div class="min-w-0 flex-grow">
      <div class="mb-0.5 flex items-center justify-between gap-2">
        <div class="flex min-w-0 items-center gap-1.5">
          <h3 class="truncate font-headline text-[14px] font-bold leading-tight text-primary">
            {{ invoice.invoiceNumber }}
          </h3>
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
        </div>
        <span class="shrink-0 font-headline text-sm font-bold text-primary">
          {{ formatMoney(invoice.grandTotal) }}
        </span>
      </div>

      <p class="mb-0.5 truncate font-body text-xs text-on-surface-variant">
        <template v-if="invoice.customer?.customerName || invoice.customer?.phone">
          <template v-if="invoice.customer?.customerName">{{ invoice.customer.customerName }}</template>
          <template v-if="invoice.customer?.customerName && invoice.customer?.phone"> · </template>
          <template v-if="invoice.customer?.phone">{{ invoice.customer.phone }}</template>
        </template>
        <template v-else>{{ invoice.customerId }}</template>
      </p>

      <div class="flex items-center justify-between gap-2">
        <p class="truncate font-body text-xs text-on-surface-variant">
          Issued {{ invoice.issuedDate ? formatSheetDate(invoice.issuedDate) : '—' }} · Due
          <span :class="invoice.status === 'OVERDUE' ? 'text-error' : ''">{{ invoice.dueDate ? formatSheetDate(invoice.dueDate) : '—' }}</span>
        </p>
        <span
          v-if="invoice.paidAmount > 0 && invoice.balanceDue > 0"
          class="shrink-0 font-body text-xs text-on-surface-variant"
        >
          Paid {{ formatMoney(invoice.paidAmount) }} · {{ formatMoney(invoice.balanceDue) }} left
        </span>
      </div>
    </div>
  </article>
</template>
