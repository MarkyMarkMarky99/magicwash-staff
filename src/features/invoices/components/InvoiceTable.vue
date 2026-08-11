<script setup lang="ts">
import type { InvoiceListItemDto, InvoiceStatusDto } from '../types/invoices.types'
import { formatSheetDate } from '@/shared/utils/sheet-date'

defineProps<{
  invoices: InvoiceListItemDto[]
}>()

const emit = defineEmits<{
  select: [invoice: InvoiceListItemDto]
}>()

function formatCurrency(value: number) {
  return `฿${Number(value).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function formatDate(value: string | null) {
  return formatSheetDate(value, '-')
}

function getBillingTypeLabel(billingType: InvoiceListItemDto['billingType']) {
  return billingType === 'CYCLE' ? 'Cycle billing' : 'Order billing'
}

function getStatusLabel(status: InvoiceStatusDto) {
  const labels: Record<InvoiceStatusDto, string> = {
    DRAFT: 'Draft',
    UNPAID: 'Unpaid',
    OVERDUE: 'Overdue',
    PARTIALLY_PAID: 'Partially paid',
    PAID: 'Paid',
    CANCELLED: 'Cancelled',
    VOID: 'Void',
  }

  return labels[status]
}

function getStatusBadgeClass(status: InvoiceStatusDto) {
  const badgeClasses: Record<InvoiceStatusDto, string> = {
    DRAFT: 'bg-gray-100 text-gray-600',
    UNPAID: 'bg-error-container text-error',
    OVERDUE: 'bg-error text-on-error',
    PARTIALLY_PAID: 'bg-blue-100 text-blue-700',
    PAID: 'bg-success-container text-success',
    CANCELLED: 'bg-error-container text-on-error-container',
    VOID: 'bg-error-container text-on-error-container',
  }

  return badgeClasses[status]
}
</script>

<template>
  <div class="w-full overflow-x-auto bg-white">
    <table class="min-w-full border-collapse text-left">
      <thead class="bg-surface-container-low text-primary">
        <tr>
          <th class="px-4 py-3 text-[11px] font-bold uppercase tracking-wide">Invoice</th>
          <th class="px-4 py-3 text-[11px] font-bold uppercase tracking-wide">Customer</th>
          <th class="px-4 py-3 text-[11px] font-bold uppercase tracking-wide">Issued</th>
          <th class="px-4 py-3 text-[11px] font-bold uppercase tracking-wide">Due</th>
          <th class="px-4 py-3 text-[11px] font-bold uppercase tracking-wide">Status</th>
          <th class="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wide">Total</th>
        </tr>
      </thead>

      <tbody class="divide-y divide-outline-variant/10">
        <tr
          v-for="invoice in invoices"
          :key="invoice.invoiceNumber"
          class="cursor-pointer transition-colors hover:bg-surface-container-lowest"
          @click="emit('select', invoice)"
        >
          <td class="px-4 py-3">
            <p class="font-headline text-sm font-bold text-primary">
              {{ invoice.invoiceNumber }}
            </p>
            <p class="mt-0.5 text-xs text-on-surface-variant">
              {{ getBillingTypeLabel(invoice.billingType) }}
            </p>
          </td>

          <td class="px-4 py-3">
            <p class="text-sm font-medium text-on-surface">
              {{ invoice.customer?.customerName || '—' }}
            </p>
            <p class="mt-0.5 text-xs text-on-surface-variant">
              {{ invoice.customer?.phone || '-' }}
            </p>
          </td>

          <td class="px-4 py-3 text-sm text-on-surface">
            {{ formatDate(invoice.issuedDate) }}
          </td>

          <td class="px-4 py-3 text-sm text-on-surface">
            {{ formatDate(invoice.dueDate) }}
          </td>

          <td class="px-4 py-3">
            <span
              class="inline-flex items-center rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide"
              :class="getStatusBadgeClass(invoice.status)"
            >
              {{ getStatusLabel(invoice.status) }}
            </span>
          </td>

          <td class="px-4 py-3 text-right text-sm font-bold text-on-surface">
            {{ formatCurrency(invoice.grandTotal) }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
