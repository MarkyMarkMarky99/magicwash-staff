<script setup>
import { ref, watch } from 'vue'
import FormActionButton from '../forms/shared/FormActionButton.vue'
import FormInput from '../forms/shared/FormInput.vue'

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
    <div class="flex items-end gap-2">
      <FormInput
        id="voucher-code"
        class="flex-1 min-w-0"
        label="Voucher Code"
        :model-value="localValue"
        placeholder="Enter Code"
        icon="confirmation_number"
        icon-position="left"
        label-variant="compact"
        size="sm"
        uppercase
        @update:model-value="updateValue"
        @enter="apply"
      />
      <FormActionButton
        size="sm"
        uppercase
        @click="apply"
      >
        Apply
      </FormActionButton>
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
