<script setup>
defineProps({
  invoice: {
    type: Object,
    required: true,
  },
})

function formatCurrency(value) {
  return `฿${Number(value).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function getItemsSummary(invoice) {
  if (!invoice.items?.length) {
    return 'No items'
  }

  if (invoice.items.length === 1) {
    return invoice.items[0].description
  }

  return `${invoice.items[0].description} +${invoice.items.length - 1} more`
}

function getStatusTone(status) {
  const tones = {
    UNPAID: {
      icon: 'receipt_long',
      label: 'Unpaid',
      avatar: 'bg-error-container text-error',
      badge: 'bg-error-container text-error',
    },
    PARTIAL: {
      icon: 'pending',
      label: 'Partial',
      avatar: 'bg-tertiary-container text-tertiary',
      badge: 'bg-tertiary-container text-tertiary',
    },
    PAID: {
      icon: 'check_circle',
      label: 'Paid',
      avatar: 'bg-success-container text-success',
      badge: 'bg-success-container text-success',
    },
    OVERDUE: {
      icon: 'priority_high',
      label: 'Overdue',
      avatar: 'bg-error text-on-error',
      badge: 'bg-error text-on-error',
    },
  }

  return tones[status] || tones.UNPAID
}
</script>

<template>
  <div class="px-4 py-4 flex items-center gap-3 bg-white">
    <div
      class="w-10 h-10 rounded-full flex items-center justify-center shrink-0 border border-outline-variant/10"
      :class="getStatusTone(invoice.status).avatar"
    >
      <span class="material-symbols-outlined fill-icon text-[20px]">{{ getStatusTone(invoice.status).icon }}</span>
    </div>

    <div class="min-w-0 flex-1">
      <div class="flex items-center gap-1.5 min-w-0">
        <h3 class="font-headline font-bold text-primary text-[14px] leading-tight truncate">
          {{ invoice.customerName }}
        </h3>
        <span
          class="inline-flex items-center px-1.5 py-px rounded-full font-label text-[9px] font-bold uppercase tracking-wide shrink-0"
          :class="getStatusTone(invoice.status).badge"
        >
          {{ getStatusTone(invoice.status).label }}
        </span>
      </div>

      <p class="font-body text-xs text-on-surface-variant mt-0.5 truncate">
        {{ invoice.invoiceNumber }} · Due {{ invoice.dueDate || '-' }}
      </p>

      <p class="font-body text-xs text-on-surface-variant mt-0.5 truncate">
        {{ getItemsSummary(invoice) }}
      </p>
    </div>

    <div class="text-right shrink-0">
      <p class="font-headline font-bold text-sm text-on-surface">
        {{ formatCurrency(invoice.totalAmount) }}
      </p>
      <p class="font-label text-[9px] font-bold uppercase tracking-wider text-on-surface-variant">
        {{ invoice.paymentMethod }}
      </p>
    </div>
  </div>
</template>
