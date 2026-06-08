<script setup>
defineProps({
  icon: { type: String, required: true },
  label: { type: String, default: '' },
  tone: { type: String, default: 'primary' },
  size: { type: String, default: 'md' },
  filled: { type: Boolean, default: true },
})

const TONE_CLASSES = {
  primary: 'bg-primary/10 text-primary border-outline-variant/10',
  neutral: 'bg-surface-container text-on-surface-variant border-outline-variant/20',
  success: 'bg-green-50 text-green-700 border-green-100',
  warning: 'bg-amber-50 text-amber-700 border-amber-100',
  danger: 'bg-red-50 text-red-700 border-red-100',
}

const SIZE_CLASSES = {
  sm: 'w-9 h-9 text-[18px]',
  md: 'w-10 h-10 text-[20px]',
  lg: 'w-12 h-12 text-[24px]',
}
</script>

<template>
  <div
    class="rounded-full flex items-center justify-center shrink-0 border"
    :class="[
      TONE_CLASSES[tone] || TONE_CLASSES.primary,
      SIZE_CLASSES[size] || SIZE_CLASSES.md,
    ]"
    :aria-label="label || undefined"
    :aria-hidden="label ? undefined : 'true'"
  >
    <span
      class="material-symbols-outlined"
      :class="filled ? 'fill-icon' : ''"
    >
      {{ icon }}
    </span>
  </div>
</template>
