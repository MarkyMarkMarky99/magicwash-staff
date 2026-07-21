<script setup>
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
  <section class="space-y-3 pb-4">
    <label :for="id" class="font-headline font-bold text-base text-primary block">
      {{ label }}
    </label>

    <div class="relative group">
      <textarea
        :id="id"
        :value="modelValue"
        class="w-full h-32 p-4 rounded-xl bg-surface-container border border-outline-variant/30 focus:border-primary focus:ring-1 focus:ring-primary focus:bg-surface-container-lowest font-body text-sm text-on-surface placeholder:text-on-surface-variant/60 resize-none transition-colors"
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
