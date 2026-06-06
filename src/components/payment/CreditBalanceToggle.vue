<script setup>
import FormToggleRow from '../forms/shared/FormToggleRow.vue'

defineProps({
  modelValue: { type: Boolean, default: false },
  availableCredit: { type: Number, default: 0 },
  formatCurrency: {
    type: Function,
    required: true,
  },
})

defineEmits(['update:modelValue'])
</script>

<template>
  <FormToggleRow
    :model-value="modelValue"
    label="Credit Balance"
    icon="account_balance_wallet"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <template #helper>
      Available: <span class="font-semibold text-on-surface">{{ formatCurrency(availableCredit) }}</span>
    </template>
  </FormToggleRow>
</template>
