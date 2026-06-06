<script setup>
import { ref, watch } from 'vue'
import FormToggleRow from '../forms/shared/FormToggleRow.vue'
import FormOptionGrid from '../forms/shared/FormOptionGrid.vue'
import FormInput from '../forms/shared/FormInput.vue'
import FormActionButton from '../forms/shared/FormActionButton.vue'
import SectionContainer from '../shared/SectionContainer.vue'

const props = defineProps({
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

const emit = defineEmits([
  'update:creditEnabled',
  'update:voucherCode',
  'applyVoucher',
  'update:paymentMethod',
])

const localVoucherCode = ref(props.voucherCode)

watch(() => props.voucherCode, value => {
  localVoucherCode.value = value
})

function updateVoucherValue(value) {
  localVoucherCode.value = value.toUpperCase()
  emit('update:voucherCode', localVoucherCode.value)
}

function applyVoucher() {
  emit('applyVoucher', localVoucherCode.value.trim().toUpperCase())
}

const paymentChannels = [
  { value: 'transfer', label: 'Bank Transfer', icon: 'account_balance' },
  { value: 'cod', label: 'Cash on Delivery', icon: 'payments' },
]
</script>

<template>
  <SectionContainer title="Payment" icon="wallet">
    <div class="p-4 space-y-6">
      <FormToggleRow
        :model-value="creditEnabled"
        label="Credit Balance"
        icon="account_balance_wallet"
        @update:model-value="$emit('update:creditEnabled', $event)"
      >
        <template #helper>
          Available: <span class="font-semibold text-on-surface">{{ formatCurrency(availableCredit) }}</span>
        </template>
      </FormToggleRow>

      <div class="space-y-2">
        <div class="flex items-end gap-2">
          <FormInput
            id="voucher-code"
            class="flex-1 min-w-0"
            label="Voucher Code"
            :model-value="localVoucherCode"
            placeholder="Enter Code"
            icon="confirmation_number"
            icon-position="left"
            label-variant="compact"
            size="sm"
            uppercase
            @update:model-value="updateVoucherValue"
            @enter="applyVoucher"
          />
          <FormActionButton
            size="sm"
            uppercase
            @click="applyVoucher"
          >
            Apply
          </FormActionButton>
        </div>
        <p
          v-if="voucherMessage"
          class="text-xs font-medium flex items-center gap-1"
          :class="voucherStatus === 'success' ? 'text-primary' : 'text-error'"
        >
          <span class="material-symbols-outlined text-[16px]">
            {{ voucherStatus === 'success' ? 'check_circle' : 'error' }}
          </span>
          {{ voucherMessage }}
        </p>
      </div>

      <FormOptionGrid
        label="Payment Channel"
        :model-value="paymentMethod"
        :options="paymentChannels"
        variant="tile"
        @update:model-value="$emit('update:paymentMethod', $event)"
      />
    </div>
  </SectionContainer>
</template>
