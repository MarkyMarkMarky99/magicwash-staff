<script setup>
defineProps({
  modelValue: { type: Boolean, default: false },
  label: { type: String, required: true },
  helperText: { type: String, default: '' },
  icon: { type: String, default: '' },
  iconClass: {
    type: String,
    default: 'bg-tertiary-container text-on-tertiary-container',
  },
  disabled: { type: Boolean, default: false },
})

defineEmits(['update:modelValue'])
</script>

<template>
  <div class="flex items-center justify-between gap-4">
    <div class="flex items-center gap-3 min-w-0">
      <div
        v-if="icon"
        class="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
        :class="iconClass"
      >
        <span class="material-symbols-outlined text-[20px]">{{ icon }}</span>
      </div>
      <div class="min-w-0">
        <p class="text-sm font-bold text-on-surface">{{ label }}</p>
        <p v-if="helperText || $slots.helper" class="text-xs text-on-surface-variant">
          <slot name="helper">{{ helperText }}</slot>
        </p>
      </div>
    </div>

    <label
      class="relative inline-flex h-7 w-12 shrink-0 items-center"
      :class="disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'"
    >
      <input
        type="checkbox"
        class="peer sr-only"
        :checked="modelValue"
        :disabled="disabled"
        @change="$emit('update:modelValue', $event.target.checked)"
      >
      <span class="absolute inset-0 rounded-full bg-outline-variant transition-colors peer-checked:bg-primary peer-disabled:bg-outline-variant/50" />
      <span class="absolute left-1 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
    </label>
  </div>
</template>
