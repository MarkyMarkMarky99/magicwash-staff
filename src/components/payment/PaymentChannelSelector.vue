<script setup>
const props = defineProps({
  modelValue: { type: String, default: 'transfer' },
  channels: {
    type: Array,
    default: () => [
      { value: 'transfer', label: 'Bank Transfer', icon: 'account_balance' },
      { value: 'cod', label: 'Cash on Delivery', icon: 'payments' },
    ],
  },
})

const emit = defineEmits(['update:modelValue'])

function selectChannel(value) {
  emit('update:modelValue', value)
}
</script>

<template>
  <div class="space-y-3">
    <p class="text-[11px] font-bold text-on-surface-variant uppercase tracking-wide">Payment Channel</p>
    <div class="grid grid-cols-2 gap-3">
      <button
        v-for="channel in channels"
        :key="channel.value"
        type="button"
        class="relative min-h-[92px] rounded-lg border p-3 flex flex-col items-center justify-center text-center gap-2 transition-all active:scale-[0.98]"
        :class="channel.value === props.modelValue
          ? 'border-primary bg-secondary-container/45 text-primary shadow-sm'
          : 'border-outline-variant/35 bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container'"
        @click="selectChannel(channel.value)"
      >
        <span
          class="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary text-on-primary flex items-center justify-center transition-all"
          :class="channel.value === props.modelValue ? 'scale-100 opacity-100' : 'scale-75 opacity-0'"
        >
          <span class="material-symbols-outlined text-[14px]">check</span>
        </span>
        <span class="material-symbols-outlined text-[24px]">{{ channel.icon }}</span>
        <span class="text-xs font-bold leading-tight">{{ channel.label }}</span>
      </button>
    </div>
  </div>
</template>
