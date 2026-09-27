<script setup>
defineProps({
  icon: { type: String, required: true },
  label: { type: String, default: '' },
  tone: { type: String, default: 'brand' },
  size: { type: String, default: 'md' },
  filled: { type: Boolean, default: true },
})

const TONE_CLASSES = {
  brand: 'bg-primary/10 text-primary border-outline-variant/10',
  neutral: 'bg-surface-container text-on-surface-variant border-outline-variant/20',
  accent: 'bg-secondary-container/50 text-on-secondary-container border-outline-variant',
  info: 'bg-info-container/50 text-on-info-container border-info/20',
  warning: 'bg-warning-container/50 text-on-warning-container border-warning/20',
  success: 'bg-success-container/50 text-on-success-container border-success/20',
  danger: 'bg-error-container/50 text-on-error-container border-error/20',
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
      TONE_CLASSES[tone] || TONE_CLASSES.brand,
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
