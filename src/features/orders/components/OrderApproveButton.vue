<script setup lang="ts">
defineProps<{
  saving: boolean
  disabled: boolean
  reason?: string | null
}>()

const emit = defineEmits<{
  approve: []
}>()
</script>

<template>
  <div class="flex flex-col items-center">
    <p v-if="disabled && !saving && reason" class="approve-reason" role="status">{{ reason }}</p>
    <button
      type="button"
      class="approve-sticker"
      :class="{ 'is-saving': saving }"
      :disabled="disabled || saving"
      :aria-label="saving ? 'Saving approval' : 'Approve order'"
      @click="emit('approve')"
    >
      <svg class="approve-glyph" :class="{ 'is-spinning': saving }" viewBox="0 0 28 28" aria-hidden="true">
        <path :d="saving ? 'M14 4a10 10 0 1 1-7 3' : 'm5 14 6 6L23 7'" />
      </svg>
      <span class="approve-label">{{ saving ? 'Saving…' : 'Approve' }}</span>
    </button>
  </div>
</template>

<style scoped>
.approve-sticker {
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

.approve-sticker:focus {
  outline: none;
}

.approve-sticker:not(:disabled):hover,
.approve-sticker:not(:disabled):focus-visible {
  transform: rotate(-7deg) translate(-1px, -1px);
  box-shadow: 6px 6px 0 color-mix(in srgb, var(--color-primary) 70%, black);
}

.approve-sticker:not(:disabled):active {
  transform: rotate(-7deg) scale(.92) translate(2px, 2px);
  box-shadow: 1px 1px 0 color-mix(in srgb, var(--color-primary) 70%, black);
}

.approve-sticker:disabled {
  background: var(--color-surface-container-high);
  color: var(--color-on-surface-variant);
  box-shadow: 3px 3px 0 var(--color-outline-variant);
}

.approve-sticker.is-saving {
  background: var(--color-primary);
  color: var(--color-lime);
  box-shadow: 4px 4px 0 color-mix(in srgb, var(--color-primary) 70%, black);
}

.approve-glyph {
  width: 27px;
  height: 27px;
  overflow: visible;
}

.approve-glyph path {
  fill: none;
  stroke: currentColor;
  stroke-width: 4;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.approve-glyph.is-spinning {
  width: 21px;
  height: 21px;
  animation: approve-spin 700ms linear infinite;
}

.approve-glyph.is-spinning path {
  stroke-dasharray: 25 18;
}

.approve-label {
  transform: rotate(7deg);
  font-family: var(--font-label);
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
}

.approve-reason {
  margin-bottom: 6px;
  max-width: 112px;
  color: var(--color-error);
  font-family: var(--font-label);
  font-size: 10px;
  font-weight: 700;
  line-height: 1.15;
  text-align: center;
}

.approve-reason::after {
  content: "";
  display: block;
  width: 0;
  height: 0;
  margin: 3px auto 0;
  border: 4px solid transparent;
  border-top-color: var(--color-error);
}

@keyframes approve-spin {
  to { transform: rotate(360deg); }
}

@media (prefers-reduced-motion: reduce) {
  .approve-sticker {
    transition: none;
  }

  .approve-glyph.is-spinning {
    animation-duration: 2s;
  }
}
</style>
