<script setup>
defineProps({
  label:      { type: String, required: true },
  modelValue: { type: /** @type {import('vue').PropType<string | null>} */ (String), default: '' },
  options:    { type: Array, required: true },
  variant:    { type: String, default: 'card' },
})

defineEmits(['update:modelValue'])
</script>

<template>
  <fieldset class="form-option-grid">
    <legend class="form-option-grid__label">
      {{ label }}
    </legend>

    <div class="option-grid">
      <button
        v-for="option in options"
        :key="option.value"
        type="button"
        :disabled="option.disabled"
        class="option-button"
        :class="[
          variant === 'compact' ? 'option-button--compact' : 'option-button--card',
          option.disabled
            ? 'option-button--disabled'
            : option.value === modelValue
              ? 'option-button--selected'
              : 'option-button--unselected',
        ]"
        @click="!option.disabled && $emit('update:modelValue', option.value)"
      >
        <span
          v-if="option.icon"
          class="material-symbols-outlined option-icon"
          :class="[
            variant === 'compact' ? 'option-icon--compact' : 'option-icon--card',
          ]"
          aria-hidden="true"
        >{{ option.icon }}</span>
        <span class="option-label">
          {{ option.label }}
        </span>
      </button>
    </div>
  </fieldset>
</template>

<style scoped>
.form-option-grid {
  min-width: 0;
  padding: 0;
  margin: 0;
  border: 0;
  font-family: 'Noto Sans Thai', system-ui, sans-serif;
}

.form-option-grid__label {
  display: block;
  padding: 0;
  margin-bottom: 6px;
  font-family: 'Noto Sans Thai', system-ui, sans-serif;
  font-size: 12px;
  font-weight: 700;
  color: var(--color-on-surface);
}

.option-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.option-button {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  padding: 0 12px;
  color: var(--color-on-surface);
  border: 1px solid var(--color-outline-variant);
  border-radius: 10px;
  outline: 0;
  background: white;
  box-shadow: 0 1px 0 color-mix(in srgb, var(--color-primary) 2%, transparent);
  font-family: 'Noto Sans Thai', system-ui, sans-serif;
  font-size: 14px;
  line-height: 1.25;
  transition: border-color 150ms, box-shadow 150ms, background-color 150ms, color 150ms;
}

.option-button--compact {
  min-height: 47px;
  gap: 6px;
}

.option-button--card {
  min-height: 64px;
  padding-top: 12px;
  padding-bottom: 12px;
  flex-direction: column;
  gap: 4px;
}

.option-button--unselected:hover:not(:disabled) {
  border-color: var(--color-outline);
}

.option-button--selected {
  color: white;
  border-color: var(--color-primary);
  background: var(--color-primary);
  font-weight: 700;
}

.option-button:focus-visible {
  border-color: var(--color-secondary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-secondary) 14%, transparent);
}

.option-button--disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.option-icon {
  flex: 0 0 auto;
}

.option-icon--compact {
  font-size: 14px;
}

.option-icon--card {
  font-size: 20px;
}

.option-button--unselected .option-icon {
  color: var(--color-on-surface-variant);
}

.option-label {
  text-align: center;
}
</style>
