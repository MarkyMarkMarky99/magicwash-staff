<script setup lang="ts">
import type { InvoiceDetailDto } from '../services/invoice-detail.service'

defineProps<{
  customer: InvoiceDetailDto['customer'] | null | undefined
}>()
</script>

<template>
  <section class="relative rounded-2xl border border-outline-variant/40 px-4 pb-4 pt-6">
    <p class="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap bg-surface px-3 font-label text-[9px] font-bold uppercase tracking-wide text-on-surface-variant">
      Billed to
    </p>

    <div class="min-w-0">
      <h3 class="font-headline text-[15px] font-bold leading-snug text-primary">
        {{ customer?.customerName || '—' }}
      </h3>
      <p
        v-if="customer?.customerCode"
        class="mt-0.5 font-label text-[10px] font-bold tracking-wide text-on-surface-variant"
      >
        Customer No. · {{ customer.customerCode }}
      </p>

      <div v-if="customer?.phone" class="mt-1 flex items-center gap-1">
        <span class="material-symbols-outlined text-[14px] leading-none text-on-surface-variant" aria-hidden="true">call</span>
        <p class="font-body text-[11px] text-on-surface-variant">{{ customer.phone }}</p>
      </div>

      <div v-if="customer?.address" class="mt-0.5 flex items-start gap-1">
        <span class="material-symbols-outlined mt-px text-[14px] leading-none text-on-surface-variant" aria-hidden="true">location_on</span>
        <p class="font-body text-[11px] leading-relaxed text-on-surface-variant">{{ customer.address }}</p>
      </div>
    </div>
  </section>
</template>
