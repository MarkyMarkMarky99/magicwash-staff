<script setup lang="ts">
export type BadgeTone = 'neutral' | 'brand' | 'accent' | 'info' | 'warning' | 'success' | 'danger'
export type BadgeSize = 'xs' | 'sm' | 'md' | 'lg'

const props = withDefaults(
  defineProps<{
    label: string
    tone?: BadgeTone
    size?: BadgeSize
    uppercase?: boolean
  }>(),
  {
    tone: 'neutral',
    size: 'xs',
    uppercase: false,
  }
)

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: 'bg-surface-container text-on-surface-variant',
  brand: 'bg-primary/10 text-primary',
  accent: 'bg-secondary-container text-on-secondary-container',
  info: 'bg-info-container text-on-info-container',
  warning: 'bg-warning-container text-on-warning-container',
  success: 'bg-success-container text-on-success-container',
  danger: 'bg-error-container text-on-error-container',
}

const SIZE_CLASSES: Record<BadgeSize, string> = {
  xs: 'px-1.5 py-px text-[9px]',
  sm: 'px-2 py-px text-[9px]',
  md: 'px-2 py-1 text-[10px]',
  lg: 'px-2.5 py-1 text-[10px]',
}
</script>

<template>
  <span
    class="inline-flex shrink-0 items-center rounded-full font-label font-bold"
    :class="[
      TONE_CLASSES[props.tone],
      SIZE_CLASSES[props.size],
      props.uppercase ? 'uppercase tracking-wide' : '',
    ]"
  >
    {{ label }}
  </span>
</template>
