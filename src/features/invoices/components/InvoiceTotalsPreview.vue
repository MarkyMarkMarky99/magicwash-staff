<script setup lang="ts">
/**
 * Presentation only. Numbers are computed by the page (using the shared
 * `shared/utils/invoice-calculator.ts`), never here — this component
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
  <section class="rounded-[20px] border border-lime/25 bg-primary px-5 py-4 text-on-primary shadow-lg">
    <div v-if="itemsTotal !== invoiceTotal" class="mb-3 flex items-center justify-between border-b border-white/15 pb-3">
      <p class="font-body text-xs font-semibold text-on-primary/80">
        {{ itemCount }} line{{ itemCount === 1 ? '' : 's' }} · subtotal
      </p>
      <p class="font-body text-sm font-semibold tabular-nums">{{ formatCurrency(itemsTotal) }}</p>
    </div>

    <div class="flex items-end justify-between gap-3">
      <p class="font-label text-[9px] font-bold uppercase tracking-[0.18em] text-lime">Total due</p>
      <p class="font-headline text-[26px] font-extrabold leading-8 tracking-tight tabular-nums">{{ formatCurrency(invoiceTotal) }}</p>
    </div>
  </section>
</template>
