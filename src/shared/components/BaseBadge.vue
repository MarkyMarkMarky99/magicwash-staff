<script setup lang="ts">
export type BadgeTone = 'neutral' | 'brand' | 'accent' | 'lime' | 'info' | 'warning' | 'success' | 'danger'
export type BadgeSize = 'sm' | 'lg'
export type BadgeVariant = 'soft' | 'solid'

const props = withDefaults(
  defineProps<{
    label: string
    tone?: BadgeTone
    size?: BadgeSize
    variant?: BadgeVariant
    uppercase?: boolean
  }>(),
  {
    tone: 'neutral',
    size: 'sm',
    variant: 'soft',
    uppercase: false,
  }
)

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: 'bg-surface-container text-on-surface-variant',
  brand: 'bg-primary/10 text-primary',
  accent: 'bg-secondary-container text-on-secondary-container',
  lime: 'bg-lime text-primary',
  info: 'bg-info-container text-on-info-container',
  warning: 'bg-warning-container text-on-warning-container',
  success: 'bg-success-container text-on-success-container',
  danger: 'bg-error-container text-on-error-container',
}

const SIZE_CLASSES: Record<BadgeSize, string> = {
  sm: 'px-2 py-0.5 text-[9px] leading-none [text-box:trim-both_cap_alphabetic]',
  lg: 'px-2.5 py-1 text-[11px] leading-none [text-box:trim-both_cap_alphabetic]',
}
</script>

<template>
  <span
    class="inline-flex shrink-0 items-center rounded-full font-label font-bold"
    :class="[
      props.tone === 'danger' && props.variant === 'solid'
        ? 'bg-error text-on-error'
        : TONE_CLASSES[props.tone],
      SIZE_CLASSES[props.size],
      props.uppercase ? 'uppercase tracking-wide' : '',
    ]"
  >
    {{ label }}
  </span>
</template>
