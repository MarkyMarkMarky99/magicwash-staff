<script setup>
defineProps({
  subtotal: { type: Number, default: 0 },
  delivery: { type: Number, default: 0 },
  voucherDiscount: { type: Number, default: 0 },
  voucherCode: { type: String, default: '' },
  creditUsed: { type: Number, default: 0 },
  netTotal: { type: Number, default: 0 },
  paymentMethodLabel: { type: String, default: 'Transfer' },
  formatCurrency: {
    type: Function,
    required: true,
  },
})
</script>

<template>
  <section class="bg-surface-container-lowest border border-outline-variant/25 rounded-lg overflow-hidden">
    <div class="px-4 py-3 bg-surface-container-low border-b border-outline-variant/20">
      <h2 class="font-headline font-bold text-sm text-primary flex items-center gap-2">
        <span class="material-symbols-outlined text-[20px]">receipt_long</span>
        Summary
      </h2>
    </div>

    <div class="p-4 space-y-3 text-sm">
      <div class="flex justify-between text-on-surface-variant">
        <span>Subtotal</span>
        <span class="font-semibold text-on-surface">{{ formatCurrency(subtotal) }}</span>
      </div>
      <div class="flex justify-between text-on-surface-variant">
        <span>Delivery Fee</span>
        <span class="font-semibold text-on-surface">{{ formatCurrency(delivery) }}</span>
      </div>
      <div v-if="voucherDiscount > 0" class="flex justify-between text-primary">
        <span>
          Voucher
          <span class="ml-1 text-[10px] bg-secondary-container text-on-secondary-container px-1.5 py-0.5 rounded">
            {{ voucherCode }}
          </span>
        </span>
        <span class="font-bold">-{{ formatCurrency(voucherDiscount) }}</span>
      </div>
      <div v-if="creditUsed > 0" class="flex justify-between text-tertiary">
        <span>Credit Balance</span>
        <span class="font-bold">-{{ formatCurrency(creditUsed) }}</span>
      </div>

      <div class="border-t border-dashed border-outline-variant/60 pt-4 mt-4">
        <div class="flex justify-between items-end gap-4">
          <span class="font-bold text-on-surface">Net Total</span>
          <span class="font-headline font-extrabold text-2xl text-on-surface">{{ formatCurrency(netTotal) }}</span>
        </div>
        <div class="flex justify-end mt-2 gap-2 items-center">
          <span class="text-[10px] text-on-surface-variant uppercase font-bold">Pay Via</span>
          <span class="text-[10px] font-bold text-primary bg-secondary-container/50 px-2 py-0.5 rounded border border-primary/10 uppercase">
            {{ paymentMethodLabel }}
          </span>
        </div>
      </div>
    </div>
  </section>
</template>
