<script setup lang="ts">
import { ref } from 'vue'
import FormInput from './FormInput.vue'
import FormSwitch from './FormSwitch.vue'

const props = defineProps<{
  id: string
  label: string
  inputLabel: string
  description?: string
  modelValue: string
  placeholder?: string
  type?: string
  inputmode?: string
  autocomplete?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const open = ref(props.modelValue !== '')

function toggle(value: boolean) {
  open.value = value
  if (!value) emit('update:modelValue', '')
}

function focusInput() {
  if (open.value) document.getElementById(props.id)?.focus()
}
</script>

<template>
  <div class="form-toggle-input" :class="{ 'form-toggle-input--on': open }">
    <slot name="icon" />
    <div class="form-toggle-input__stage">
      <Transition name="form-toggle-input" mode="out-in" @after-enter="focusInput">
        <FormInput
          v-if="open"
          :id="id"
          key="input"
          :model-value="modelValue"
          :label="inputLabel"
          :type="type"
          :placeholder="placeholder"
          :inputmode="inputmode"
          :autocomplete="autocomplete"
          @update:model-value="emit('update:modelValue', $event)"
        />
        <div v-else key="text" class="form-toggle-input__text">
          <strong>{{ label }}</strong>
          <span v-if="description">{{ description }}</span>
        </div>
      </Transition>
    </div>
    <FormSwitch class="form-toggle-input__switch" :model-value="open" :label="label" @update:model-value="toggle" />
  </div>
</template>

<style scoped>
.form-toggle-input {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px 8px 10px;
  margin-bottom: 10px;
  border: 1px solid var(--color-outline-variant);
  border-radius: 999px;
  background: white;
  box-shadow: 0 1px 0 color-mix(in srgb, var(--color-primary) 2%, transparent);
  transition: border-color 180ms ease, box-shadow 180ms ease;
}

.form-toggle-input--on {
  border-color: color-mix(in srgb, var(--color-secondary) 45%, var(--color-outline-variant));
}

.form-toggle-input:focus-within {
  border-color: var(--color-lime);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-lime) 14%, transparent);
}

.form-toggle-input__stage {
  display: flex;
  flex: 1;
  align-items: center;
  min-width: 0;
  min-height: 44px;
}

.form-toggle-input__stage > * {
  flex: 1;
  min-width: 0;
}

.form-toggle-input .form-toggle-input__stage :deep(section) {
  margin: 0;
}

.form-toggle-input .form-toggle-input__stage :deep(.form-input),
.form-toggle-input .form-toggle-input__stage :deep(.form-input:focus) {
  height: 44px;
  padding: 0;
  border: 0;
  background: transparent;
  box-shadow: none;
}

.form-toggle-input__stage :deep(.form-label) {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

.form-toggle-input__text strong {
  display: block;
  color: var(--color-on-surface);
  font-size: 14px;
}

.form-toggle-input__text span {
  display: block;
  margin-top: 2px;
  color: var(--color-on-surface-variant);
  font-size: 11px;
  line-height: 1.42;
}

.form-toggle-input :deep(.form-switch) {
  flex: 0 0 auto;
  padding: 0;
  margin: 0;
  border-bottom: 0;
}

.form-toggle-input :deep(.form-switch__text) {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

.form-toggle-input :deep(.form-switch__control:not(.form-switch__control--on)) {
  background: var(--color-surface-container-highest);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--color-outline) 30%, transparent);
}

.form-toggle-input-enter-active,
.form-toggle-input-leave-active {
  transition: opacity 160ms ease, transform 160ms ease;
}

.form-toggle-input-enter-from {
  opacity: 0;
  transform: translateX(10px);
}

.form-toggle-input-leave-to {
  opacity: 0;
  transform: translateX(-10px);
}

@media (prefers-reduced-motion: reduce) {
  .form-toggle-input,
  .form-toggle-input-enter-active,
  .form-toggle-input-leave-active {
    transition: none;
  }
}
</style>
