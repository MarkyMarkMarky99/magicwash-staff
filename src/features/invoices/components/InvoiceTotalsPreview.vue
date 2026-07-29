<script setup lang="ts">
/**
 * Presentation only. Numbers are computed by the page (using the shared
 * `contracts/invoices/invoice-calculator.ts`), never here — this component
 * only formats and displays what it's given.
 */
defineProps<{
  itemCount: number
  itemsTotal: number
  invoiceTotal: number
}>()

function formatCurrency(value: number) {
  return `฿${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
</script>

<template>
  <section class="space-y-2 rounded-2xl bg-primary-container/10 border border-primary/20 p-4">
    <div class="flex items-center justify-between">
      <p class="font-body text-sm text-on-surface-variant">
        {{ itemCount }} line{{ itemCount === 1 ? '' : 's' }} · subtotal
      </p>
      <p class="font-body text-sm font-medium text-on-surface">{{ formatCurrency(itemsTotal) }}</p>
    </div>

    <div class="flex items-center justify-between border-t border-outline-variant/20 pt-2">
      <p class="font-headline text-sm font-bold text-primary">Total due</p>
      <p class="font-headline text-lg font-bold text-primary">{{ formatCurrency(invoiceTotal) }}</p>
    </div>

    <p class="font-body text-[11px] text-on-surface-variant/70">
      Preview only — the server recalculates every total when the invoice is created.
    </p>
  </section>
</template>
