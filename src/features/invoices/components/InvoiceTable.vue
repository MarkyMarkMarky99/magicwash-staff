<script setup lang="ts">
import type { InvoiceResponseDto, InvoiceStatusDto } from '../types/invoices.types'

defineProps<{
  invoices: InvoiceResponseDto[]
}>()

const emit = defineEmits<{
  select: [invoice: InvoiceResponseDto]
}>()

function formatCurrency(value: number) {
  return `฿${Number(value).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function formatDate(value: string | null) {
  return value || '-'
}

function getItemsSummary(invoice: InvoiceResponseDto) {
  if (invoice.items.length === 0) {
    return 'No items'
  }

  if (invoice.items.length === 1) {
    return invoice.items[0].description
  }

  return `${invoice.items[0].description} +${invoice.items.length - 1} more`
}

function getStatusLabel(status: InvoiceStatusDto) {
  const labels: Record<InvoiceStatusDto, string> = {
    UNPAID: 'Unpaid',
    PARTIAL: 'Partial',
    PAID: 'Paid',
    OVERDUE: 'Overdue',
  }

  return labels[status]
}

function getStatusBadgeClass(status: InvoiceStatusDto) {
  const badgeClasses: Record<InvoiceStatusDto, string> = {
    UNPAID: 'bg-error-container text-error',
    PARTIAL: 'bg-tertiary-container text-tertiary',
    PAID: 'bg-success-container text-success',
    OVERDUE: 'bg-error text-on-error',
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
          :key="invoice.id"
          class="cursor-pointer transition-colors hover:bg-surface-container-lowest"
          @click="emit('select', invoice)"
        >
          <td class="px-4 py-3">
            <p class="font-headline text-sm font-bold text-primary">
              {{ invoice.invoiceNumber }}
            </p>
            <p class="mt-0.5 text-xs text-on-surface-variant">
              {{ getItemsSummary(invoice) }}
            </p>
          </td>

          <td class="px-4 py-3">
            <p class="text-sm font-medium text-on-surface">
              {{ invoice.customerName }}
            </p>
            <p class="mt-0.5 text-xs text-on-surface-variant">
              {{ invoice.customerPhone || '-' }}
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
            {{ formatCurrency(invoice.totalAmount) }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
