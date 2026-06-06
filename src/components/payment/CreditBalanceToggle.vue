<script setup>
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
  <div class="flex items-center justify-between gap-4">
    <div class="flex items-center gap-3 min-w-0">
      <div class="w-10 h-10 rounded-full bg-tertiary-container text-on-tertiary-container flex items-center justify-center shrink-0">
        <span class="material-symbols-outlined text-[20px]">account_balance_wallet</span>
      </div>
      <div class="min-w-0">
        <p class="text-sm font-bold text-on-surface">Credit Balance</p>
        <p class="text-xs text-on-surface-variant">
          Available: <span class="font-semibold text-on-surface">{{ formatCurrency(availableCredit) }}</span>
        </p>
      </div>
    </div>

    <label class="relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center">
      <input
        type="checkbox"
        class="peer sr-only"
        :checked="modelValue"
        @change="$emit('update:modelValue', $event.target.checked)"
      >
      <span class="absolute inset-0 rounded-full bg-outline-variant transition-colors peer-checked:bg-primary" />
      <span class="absolute left-1 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
    </label>
  </div>
</template>
