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
</script>

<template>
  <div class="px-4 py-4 flex items-center gap-3 bg-white">
    <div
      class="w-10 h-10 rounded-full flex items-center justify-center shrink-0 border border-outline-variant/10"
      :class="invoice.statusTone.avatar"
    >
      <span class="material-symbols-outlined fill-icon text-[20px]">{{ invoice.statusTone.icon }}</span>
    </div>

    <div class="min-w-0 flex-1">
      <div class="flex items-center gap-1.5 min-w-0">
        <h3 class="font-headline font-bold text-primary text-[14px] leading-tight truncate">
          {{ invoice.customer }}
        </h3>
        <span
          class="inline-flex items-center px-1.5 py-px rounded-full font-label text-[9px] font-bold uppercase tracking-wide shrink-0"
          :class="invoice.statusTone.badge"
        >
          {{ invoice.statusLabel }}
        </span>
      </div>

      <p class="font-body text-xs text-on-surface-variant mt-0.5 truncate">
        {{ invoice.invoiceNo }} · Due {{ invoice.dueDate }}
      </p>

      <p class="font-body text-xs text-on-surface-variant mt-0.5 truncate">
        {{ invoice.itemsSummary }}
      </p>
    </div>

    <div class="text-right shrink-0">
      <p class="font-headline font-bold text-sm text-on-surface">
        {{ formatCurrency(invoice.total) }}
      </p>
      <p class="font-label text-[9px] font-bold uppercase tracking-wider text-on-surface-variant">
        {{ invoice.paymentMethod }}
      </p>
    </div>
  </div>
</template>
