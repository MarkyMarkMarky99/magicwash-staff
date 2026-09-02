<script setup lang="ts">
import type { InvoiceListItemDto, InvoiceStatusDto } from '../types/invoices.types'
import { formatSheetDate } from '@/shared/utils/sheet-date'
import BaseBadge from '@/shared/components/BaseBadge.vue'

type BadgeTone = 'neutral' | 'brand' | 'accent' | 'info' | 'warning' | 'success' | 'danger'

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

function getStatusBadgeTone(status: InvoiceStatusDto): BadgeTone {
  const badgeTones: Record<InvoiceStatusDto, BadgeTone> = {
    DRAFT: 'neutral',
    UNPAID: 'danger',
    OVERDUE: 'danger',
    PARTIALLY_PAID: 'info',
    PAID: 'success',
    CANCELLED: 'danger',
    VOID: 'danger',
  }

  return badgeTones[status]
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
            {{ formatSheetDate(invoice.issuedDate) }}
          </td>

          <td class="px-4 py-3 text-sm text-on-surface">
            {{ formatSheetDate(invoice.dueDate) }}
          </td>

          <td class="px-4 py-3">
            <BaseBadge
              :label="getStatusLabel(invoice.status)"
              size="md"
              :uppercase="true"
              :tone="getStatusBadgeTone(invoice.status)"
            />
          </td>

          <td class="px-4 py-3 text-right text-sm font-bold text-on-surface">
            {{ formatCurrency(invoice.grandTotal) }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
