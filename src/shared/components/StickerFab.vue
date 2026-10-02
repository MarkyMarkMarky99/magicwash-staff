<script setup lang="ts">
withDefaults(defineProps<{
  label: string
  ariaLabel?: string
  saving?: boolean
  savingLabel?: string
  disabled?: boolean
}>(), {
  ariaLabel: undefined,
  saving: false,
  savingLabel: 'Saving…',
  disabled: false,
})

const emit = defineEmits<{
  click: []
}>()
</script>

<template>
  <button
    type="button"
    class="sticker-fab"
    :class="{ 'is-saving': saving }"
    :disabled="disabled || saving"
    :aria-label="ariaLabel ?? label"
    @click="emit('click')"
  >
    <svg v-if="saving" class="sticker-spinner" viewBox="0 0 28 28" aria-hidden="true">
      <path d="M14 4a10 10 0 1 1-7 3" />
    </svg>
    <slot v-else />
    <span class="sticker-label">{{ saving ? savingLabel : label }}</span>
  </button>
</template>

<style scoped>
.sticker-fab {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  width: 72px;
  height: 72px;
  border: 0;
  border-radius: 23px 28px 24px 27px;
  background: var(--color-lime);
  color: var(--color-primary);
  box-shadow: 4px 4px 0 color-mix(in srgb, var(--color-primary) 70%, black);
  transform: rotate(-7deg);
  transition: transform 160ms, box-shadow 160ms, background-color 160ms, color 160ms;
}

.sticker-fab:focus {
  outline: none;
}

.sticker-fab:not(:disabled):hover,
.sticker-fab:not(:disabled):focus-visible {
  transform: rotate(-7deg) translate(-1px, -1px);
  box-shadow: 6px 6px 0 color-mix(in srgb, var(--color-primary) 70%, black);
}

.sticker-fab:not(:disabled):active {
  transform: rotate(-7deg) scale(.92) translate(2px, 2px);
  box-shadow: 1px 1px 0 color-mix(in srgb, var(--color-primary) 70%, black);
}

.sticker-fab:disabled {
  background: var(--color-surface-container-high);
  color: var(--color-on-surface-variant);
  box-shadow: 3px 3px 0 var(--color-outline-variant);
}

.sticker-fab.is-saving {
  background: var(--color-primary);
  color: var(--color-lime);
  box-shadow: 4px 4px 0 color-mix(in srgb, var(--color-primary) 70%, black);
}

.sticker-spinner {
  width: 21px;
  height: 21px;
  overflow: visible;
  animation: sticker-spin 700ms linear infinite;
}

.sticker-spinner path {
  fill: none;
  stroke: currentColor;
  stroke-width: 4;
  stroke-linecap: round;
  stroke-dasharray: 25 18;
}

.sticker-label {
  transform: rotate(7deg);
  font-family: var(--font-label);
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
}

@keyframes sticker-spin {
  to { transform: rotate(360deg); }
}

@media (prefers-reduced-motion: reduce) {
  .sticker-fab {
    transition: none;
  }

  .sticker-spinner {
    animation-duration: 2s;
  }
}
</style>
