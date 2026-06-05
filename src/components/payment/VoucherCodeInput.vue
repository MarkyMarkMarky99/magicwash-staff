<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  modelValue: { type: String, default: '' },
  message: { type: String, default: '' },
  status: {
    type: String,
    default: 'idle',
    validator: value => ['idle', 'success', 'error'].includes(value),
  },
})

const emit = defineEmits(['update:modelValue', 'apply'])
const localValue = ref(props.modelValue)

watch(() => props.modelValue, value => {
  localValue.value = value
})

function updateValue(value) {
  localValue.value = value.toUpperCase()
  emit('update:modelValue', localValue.value)
}

function apply() {
  emit('apply', localValue.value.trim().toUpperCase())
}
</script>

<template>
  <div class="space-y-2">
    <label for="voucher-code" class="text-[11px] font-bold text-on-surface-variant uppercase tracking-wide block">
      Voucher Code
    </label>
    <div class="flex gap-2">
      <div class="relative flex-1 min-w-0">
        <input
          id="voucher-code"
          :value="localValue"
          type="text"
          placeholder="Enter Code"
          class="w-full bg-surface-container border border-outline-variant/40 text-on-surface text-sm rounded-lg focus:ring-1 focus:ring-primary focus:border-primary block p-2.5 pl-9 uppercase placeholder:normal-case placeholder:text-on-surface-variant/60"
          @input="updateValue($event.target.value)"
          @keydown.enter.prevent="apply"
        >
        <span class="material-symbols-outlined text-[20px] absolute inset-y-0 left-3 flex items-center text-on-surface-variant pointer-events-none">
          confirmation_number
        </span>
      </div>
      <button
        type="button"
        class="px-4 py-2 bg-primary hover:brightness-110 text-on-primary text-xs font-bold uppercase tracking-wide rounded-lg transition-colors active:scale-[0.98]"
        @click="apply"
      >
        Apply
      </button>
    </div>
    <p
      v-if="message"
      class="text-xs font-medium flex items-center gap-1"
      :class="status === 'success' ? 'text-primary' : 'text-error'"
    >
      <span class="material-symbols-outlined text-[16px]">
        {{ status === 'success' ? 'check_circle' : 'error' }}
      </span>
      {{ message }}
    </p>
  </div>
</template>
