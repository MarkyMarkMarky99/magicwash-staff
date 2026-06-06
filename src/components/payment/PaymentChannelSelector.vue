<script setup>
import FormOptionGrid from '../forms/shared/FormOptionGrid.vue'

defineProps({
  modelValue: { type: String, default: 'transfer' },
  channels: {
    type: Array,
    default: () => [
      { value: 'transfer', label: 'Bank Transfer', icon: 'account_balance' },
      { value: 'cod', label: 'Cash on Delivery', icon: 'payments' },
    ],
  },
})

defineEmits(['update:modelValue'])
</script>

<template>
  <FormOptionGrid
    label="Payment Channel"
    :model-value="modelValue"
    :options="channels"
    variant="tile"
    @update:model-value="$emit('update:modelValue', $event)"
  />
</template>
