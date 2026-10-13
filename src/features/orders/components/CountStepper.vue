<script setup lang="ts">
import { parseCountInput, stepCount } from '@/features/orders/utils/corporate-order-draft'

const props = withDefaults(defineProps<{
  modelValue: number | null
  label: string
  size?: 'row' | 'large'
}>(), { size: 'row' })

const emit = defineEmits<{ 'update:modelValue': [value: number | null] }>()

function onInput(event: Event): void {
  const input = event.target as HTMLInputElement
  const next = parseCountInput(input.value)
  const text = next === null ? '' : String(next)
  if (input.value !== text) input.value = text
  emit('update:modelValue', next)
}

function onBlur(event: Event): void {
  const input = event.target as HTMLInputElement
  input.value = props.modelValue === null ? '' : String(props.modelValue)
}
</script>

<template>
  <div class="stepper" :class="`stepper--${size}`">
    <button type="button" class="stepper__btn stepper__btn--dec" :disabled="!modelValue" :aria-label="`Fewer ${label}`" @click="emit('update:modelValue', stepCount(modelValue, -1))">
      <span class="material-symbols-outlined" aria-hidden="true">remove</span>
    </button>
    <input
      class="stepper__input"
      type="text"
      inputmode="numeric"
      autocomplete="off"
      placeholder="–"
      :value="modelValue ?? ''"
      :aria-label="`Counted ${label}`"
      @input="onInput"
      @focus="($event.target as HTMLInputElement).select()"
      @blur="onBlur"
      @keydown.enter.prevent="($event.target as HTMLInputElement).blur()"
    >
    <button type="button" class="stepper__btn stepper__btn--inc" :aria-label="`More ${label}`" @click="emit('update:modelValue', stepCount(modelValue, 1))">
      <span class="material-symbols-outlined" aria-hidden="true">add</span>
    </button>
  </div>
</template>

<style scoped>
.stepper {
  display: flex;
  align-items: center;
  gap: 1px;
}

.stepper__btn {
  display: grid;
  flex: none;
  place-items: center;
  width: 32px;
  height: 36px;
  border-radius: 11px 13px 11px 12px;
  transition: transform 120ms, box-shadow 120ms, opacity 120ms;
  touch-action: manipulation;
}

.stepper__btn .material-symbols-outlined {
  font-size: 22px;
  font-variation-settings: 'FILL' 0, 'wght' 600, 'GRAD' 0, 'opsz' 24;
}

.stepper__btn--dec {
  border: 2px solid var(--color-primary);
  background: white;
  color: var(--color-primary);
  box-shadow: 2px 2px 0 color-mix(in srgb, var(--color-primary) 28%, white);
}

.stepper__btn--inc {
  background: var(--color-lime);
  color: var(--color-primary);
  box-shadow: 3px 3px 0 color-mix(in srgb, var(--color-primary) 70%, black);
}

.stepper__btn:active:not(:disabled) {
  transform: scale(.92) translate(2px, 2px);
  box-shadow: 1px 1px 0 color-mix(in srgb, var(--color-primary) 70%, black);
}

.stepper__btn:disabled {
  opacity: .32;
  box-shadow: none;
}

.stepper__btn:focus-visible,
.stepper__input:focus-visible {
  outline: 2px solid var(--color-lime);
  outline-offset: 2px;
}

.stepper__input {
  width: 36px;
  height: 36px;
  padding: 0;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--color-primary);
  font-size: 16px;
  font-weight: 800;
  line-height: 1;
  text-align: center;
  font-variant-numeric: tabular-nums;
  outline: 0;
}

.stepper__input::placeholder {
  color: var(--color-on-surface-variant);
  opacity: .55;
}

.stepper__input:focus {
  background: var(--color-surface-container-low);
  box-shadow: inset 0 0 0 2px var(--color-lime);
}

.stepper--large {
  gap: 6px;
}

.stepper--large .stepper__btn {
  width: 48px;
  height: 48px;
  border-radius: 14px 16px 13px 15px;
}

.stepper--large .stepper__input {
  width: 72px;
  height: 48px;
  font-size: 26px;
}

@media (prefers-reduced-motion: reduce) {
  .stepper__btn {
    transition: none;
  }
}
</style>
