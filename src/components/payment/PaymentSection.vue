<script setup>
import CreditBalanceToggle from './CreditBalanceToggle.vue'
import VoucherCodeInput from './VoucherCodeInput.vue'
import PaymentChannelSelector from './PaymentChannelSelector.vue'

defineProps({
  creditEnabled: { type: Boolean, default: false },
  availableCredit: { type: Number, default: 0 },
  voucherCode: { type: String, default: '' },
  voucherMessage: { type: String, default: '' },
  voucherStatus: { type: String, default: 'idle' },
  paymentMethod: { type: String, default: 'transfer' },
  formatCurrency: {
    type: Function,
    required: true,
  },
})

defineEmits([
  'update:creditEnabled',
  'update:voucherCode',
  'applyVoucher',
  'update:paymentMethod',
])
</script>

<template>
  <section class="bg-surface-container-lowest border border-outline-variant/25 rounded-lg overflow-hidden">
    <div class="px-4 py-3 bg-surface-container-low border-b border-outline-variant/20">
      <h2 class="font-headline font-bold text-sm text-primary flex items-center gap-2">
        <span class="material-symbols-outlined text-[20px]">wallet</span>
        Payment
      </h2>
    </div>

    <div class="p-4 space-y-6">
      <CreditBalanceToggle
        :model-value="creditEnabled"
        :available-credit="availableCredit"
        :format-currency="formatCurrency"
        @update:model-value="$emit('update:creditEnabled', $event)"
      />

      <VoucherCodeInput
        :model-value="voucherCode"
        :message="voucherMessage"
        :status="voucherStatus"
        @update:model-value="$emit('update:voucherCode', $event)"
        @apply="$emit('applyVoucher', $event)"
      />

      <PaymentChannelSelector
        :model-value="paymentMethod"
        @update:model-value="$emit('update:paymentMethod', $event)"
      />
    </div>
  </section>
</template>
