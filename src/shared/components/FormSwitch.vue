<script setup lang="ts">
import { useId } from 'vue'

defineProps<{
  modelValue: boolean
  label: string
  description?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const labelId = useId()
const descriptionId = useId()
</script>

<template>
  <div class="form-switch">
    <div class="form-switch__text">
      <strong :id="labelId">{{ label }}</strong>
      <span v-if="description" :id="descriptionId">{{ description }}</span>
    </div>
    <button
      class="form-switch__control"
      :class="{ 'form-switch__control--on': modelValue }"
      type="button"
      role="switch"
      :aria-checked="modelValue"
      :aria-labelledby="labelId"
      :aria-describedby="description ? descriptionId : undefined"
      @click="emit('update:modelValue', !modelValue)"
    />
  </div>
</template>

<style scoped>
.form-switch {
  display: flex;
  align-items: center;
  gap: 13px;
  padding: 0 0 19px;
  margin-bottom: 18px;
  border-bottom: 1px solid #cfe2de;
  font-family: 'Noto Sans Thai', system-ui, sans-serif;
}

.form-switch__text {
  flex: 1;
  min-width: 0;
}

.form-switch__text strong {
  display: block;
  color: #073f38;
  font-size: 14px;
}

.form-switch__text span {
  display: block;
  margin-top: 2px;
  color: #5f7772;
  font-size: 11px;
  line-height: 1.42;
}

.form-switch__control {
  position: relative;
  flex: 0 0 auto;
  width: 47px;
  height: 28px;
  border: 0;
  border-radius: 20px;
  background: #b7cac6;
  box-shadow: inset 0 0 0 1px rgba(0, 79, 69, 0.08);
}

.form-switch__control::after {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 22px;
  height: 22px;
  content: '';
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
  transition: 0.18s ease;
}

.form-switch__control--on {
  background: #007a69;
}

.form-switch__control--on::after {
  transform: translateX(19px);
}

.form-switch__control:focus-visible {
  outline: 3px solid #eab308;
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  .form-switch__control::after {
    transition: none;
  }
}
</style>
