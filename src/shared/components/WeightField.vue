<script setup lang="ts">
import { MAX_ORDER_IMAGE_WEIGHT_KG } from '@shared/utils/item-quantity'

defineProps<{
  modelValue: string
  inputId: string
  error?: string | null
}>()
const emit = defineEmits<{
  'update:modelValue': [value: string]
  invalid: []
}>()

function handleInvalid(event: Event): void {
  event.preventDefault()
  emit('invalid')
}
</script>

<template>
  <div>
    <div class="weight-field flex items-end gap-4 pb-2 pr-2">
      <div class="weight-field__col min-w-0 flex-1">
        <div class="weight-field__wrap" :class="{ 'is-invalid': Boolean(error) }">
          <label :for="inputId" class="weight-field__tab">Weight</label>
          <input :id="inputId" :value="modelValue" class="weight-field__input" type="number" placeholder="e.g. 20.5" min="0.1" :max="String(MAX_ORDER_IMAGE_WEIGHT_KG)" step="0.1" inputmode="decimal" :aria-describedby="error ? `${inputId}-error` : undefined" :aria-invalid="Boolean(error)" @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)" @invalid="handleInvalid">
          <span class="weight-field__unit" aria-hidden="true"><span>kg</span></span>
        </div>
      </div>
      <slot name="action" />
    </div>
    <p v-if="error" :id="`${inputId}-error`" class="mt-2 font-body text-sm text-error">{{ error }}</p>
  </div>
</template>

<style scoped>
.weight-field__col {
  padding-top: 14px;
}

.weight-field__wrap {
  position: relative;
  --weight-edge: var(--color-primary);
  --weight-shadow: color-mix(in srgb, var(--color-primary) 70%, black);
}

.weight-field__wrap.is-invalid {
  --weight-edge: var(--color-error);
  --weight-shadow: color-mix(in srgb, var(--color-error) 70%, black);
}

.weight-field__input {
  display: block;
  width: 100%;
  min-width: 0;
  height: 47px;
  margin: 0;
  padding: 0 56px 0 12px;
  color: var(--color-on-surface);
  caret-color: var(--color-primary);
  background: #fff;
  border: 2px solid var(--weight-edge);
  border-radius: 11px 15px 12px 14px;
  box-shadow: 4px 4px 0 var(--weight-shadow);
  outline: 0;
  appearance: textfield;
  -moz-appearance: textfield;
  font: 700 20px/1 var(--font-headline);
  font-variant-numeric: tabular-nums;
  transition: transform 160ms, box-shadow 160ms;
}

.weight-field__input::-webkit-inner-spin-button,
.weight-field__input::-webkit-outer-spin-button {
  margin: 0;
  -webkit-appearance: none;
}

.weight-field__input::placeholder {
  color: var(--color-on-surface-variant);
  font: 500 14px/1 var(--font-body);
}

.weight-field__input:focus {
  transform: translate(-1px, -1px);
  box-shadow: 0 0 0 1px var(--weight-edge), 6px 6px 0 var(--weight-shadow);
}

.weight-field__tab {
  position: absolute;
  z-index: 2;
  left: 10px;
  top: -10px;
  margin: 0;
  padding: 3px 9px 4px;
  border-radius: 6px 8px 6px 7px;
  background: var(--color-primary);
  color: #fff;
  font: 700 11px/1.1 var(--font-headline);
  box-shadow: 1px 1px 0 color-mix(in srgb, var(--color-primary) 70%, black);
  transform: rotate(-3deg);
  pointer-events: none;
}

.weight-field__unit {
  position: absolute;
  top: 50%;
  right: 8px;
  width: 34px;
  height: 29px;
  margin-top: -14.5px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid var(--weight-edge);
  border-radius: 10px 12px 10px 11px;
  background: #fff;
  color: var(--weight-edge);
  box-shadow: 2px 2px 0 var(--weight-shadow);
  transform: rotate(-7deg);
  pointer-events: none;
}

.weight-field__unit > span {
  transform: rotate(7deg);
  font: 800 13px/1 var(--font-headline);
}

@media (prefers-reduced-motion: reduce) {
  .weight-field__input {
    transition: none;
  }
}
</style>
