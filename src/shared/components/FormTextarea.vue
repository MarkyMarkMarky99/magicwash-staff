<script setup>
import FormLabel from './FormLabel.vue'

defineProps({
  id:          { type: String, required: true },
  label:       { type: String, required: true },
  modelValue:  { type: String, default: '' },
  placeholder: { type: String, default: '' },
  icon:        { type: String, default: '' },
})

defineEmits(['update:modelValue'])
</script>

<template>
  <section class="pb-4">
    <FormLabel :input-id="id">
      {{ label }}
    </FormLabel>

    <div class="relative group">
      <textarea
        :id="id"
        :value="modelValue"
        class="form-textarea"
        :placeholder="placeholder"
        @input="$emit('update:modelValue', $event.target.value)"
      />

      <div v-if="icon && !modelValue" class="absolute bottom-3 right-3 pointer-events-none">
        <span class="material-symbols-outlined text-on-surface-variant/40 text-[20px]" aria-hidden="true">
          {{ icon }}
        </span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.form-textarea {
  display: block;
  width: 100%;
  min-width: 0;
  height: 128px;
  padding: 12px;
  color: var(--color-on-surface);
  border: 1px solid var(--color-outline-variant);
  border-radius: 10px;
  outline: 0;
  background: white;
  box-shadow: 0 1px 0 color-mix(in srgb, var(--color-primary) 2%, transparent);
  font-family: 'Noto Sans Thai', system-ui, sans-serif;
  font-size: 14px;
  line-height: 1.5;
  resize: none;
  transition: border-color 150ms, box-shadow 150ms;
}

.form-textarea::placeholder {
  color: var(--color-on-surface-variant);
}

.form-textarea:focus {
  border-color: var(--color-lime);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-lime) 14%, transparent);
}
</style>
