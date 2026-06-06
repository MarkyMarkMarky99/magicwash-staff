<script setup>
const props = defineProps({
  label:      { type: String, required: true },
  modelValue: { type: String, default: '' },
  options:    { type: Array, required: true },
  variant:    { type: String, default: 'card' },
})

defineEmits(['update:modelValue'])
</script>

<template>
  <section class="space-y-3">
    <h2
      class="font-headline font-bold text-primary"
      :class="variant === 'tile' ? 'text-[11px] text-on-surface-variant uppercase tracking-wide' : 'text-base'"
    >
      {{ label }}
    </h2>

    <div class="grid grid-cols-2" :class="variant === 'tile' ? 'gap-3' : 'gap-2'">
      <button
        v-for="option in options"
        :key="option.value"
        type="button"
        :disabled="option.disabled"
        class="relative rounded-lg font-body text-sm flex items-center justify-center transition-all focus:outline-none focus:ring-2 focus:ring-primary"
        :class="[
          variant === 'compact'
            ? 'py-2 px-3 gap-1.5 active:scale-95'
            : variant === 'tile'
              ? 'min-h-[92px] border p-3 flex-col text-center gap-2 active:scale-[0.98]'
              : 'min-h-16 px-3 py-3 flex-col gap-1 active:scale-95',
          option.disabled
            ? 'border border-outline-variant/20 bg-surface-container opacity-40 cursor-not-allowed active:scale-100'
            : option.value === modelValue && variant === 'tile'
              ? 'border-primary bg-secondary-container/45 text-primary shadow-sm'
              : option.value === modelValue
                ? 'border-[1.5px] border-primary bg-primary text-on-primary font-semibold shadow-sm'
                : variant === 'tile'
                  ? 'border-outline-variant/35 bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container'
                  : 'border border-outline-variant/30 bg-surface-container-lowest text-on-surface hover:bg-surface-container-high',
        ]"
        @click="!option.disabled && $emit('update:modelValue', option.value)"
      >
        <span
          v-if="variant === 'tile'"
          class="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary text-on-primary flex items-center justify-center transition-all"
          :class="option.value === props.modelValue ? 'scale-100 opacity-100' : 'scale-75 opacity-0'"
        >
          <span class="material-symbols-outlined text-[14px]">check</span>
        </span>
        <span
          v-if="option.icon"
          class="material-symbols-outlined"
          :class="[
            variant === 'compact' ? 'text-[14px]' : variant === 'tile' ? 'text-[24px]' : 'text-[20px]',
            option.value === modelValue ? 'opacity-85' : 'text-on-surface-variant',
          ]"
          aria-hidden="true"
        >{{ option.icon }}</span>
        <span
          class="leading-tight text-center"
          :class="[
            variant === 'tile' ? 'text-xs font-bold' : '',
            variant === 'compact' && option.value !== modelValue ? 'font-medium' : '',
          ]"
        >
          {{ option.label }}
        </span>
      </button>
    </div>
  </section>
</template>
