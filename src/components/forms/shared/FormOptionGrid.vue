<script setup>
defineProps({
  label:      { type: String, required: true },
  modelValue: { type: String, default: '' },
  options:    { type: Array, required: true },
  variant:    { type: String, default: 'card' },
})

defineEmits(['update:modelValue'])
</script>

<template>
  <section class="space-y-3">
    <h2 class="font-headline font-bold text-base text-primary">
      {{ label }}
    </h2>

    <div class="grid grid-cols-2 gap-2">
      <button
        v-for="option in options"
        :key="option.value"
        type="button"
        :disabled="option.disabled"
        class="rounded-lg font-body text-sm flex items-center justify-center transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-primary"
        :class="[
          variant === 'compact' ? 'py-2 px-3 gap-1.5' : 'min-h-16 px-3 py-3 flex-col gap-1',
          option.disabled
            ? 'border border-outline-variant/20 bg-surface-container opacity-40 cursor-not-allowed active:scale-100'
            : option.value === modelValue
              ? 'border-[1.5px] border-primary bg-primary text-on-primary font-semibold shadow-sm'
              : 'border border-outline-variant/30 bg-surface-container-lowest text-on-surface hover:bg-surface-container-high',
        ]"
        @click="!option.disabled && $emit('update:modelValue', option.value)"
      >
        <span
          v-if="option.icon"
          class="material-symbols-outlined"
          :class="[
            variant === 'compact' ? 'text-[14px]' : 'text-[20px]',
            option.value === modelValue ? 'opacity-85' : 'text-on-surface-variant',
          ]"
          aria-hidden="true"
        >{{ option.icon }}</span>
        <span class="leading-tight text-center" :class="variant === 'compact' && option.value !== modelValue ? 'font-medium' : ''">
          {{ option.label }}
        </span>
      </button>
    </div>
  </section>
</template>
