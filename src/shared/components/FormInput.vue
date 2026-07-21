<script setup>
defineProps({
  id:           { type: String, required: true },
  label:        { type: String, required: true },
  modelValue:   { type: String, default: '' },
  type:         { type: String, default: 'text' },
  placeholder:  { type: String, default: '' },
  icon:         { type: String, default: '' },
  autocomplete: { type: String, default: undefined },
})

defineEmits(['update:modelValue'])
</script>

<template>
  <section class="space-y-2">
    <label :for="id" class="font-headline font-bold text-base text-primary block">
      {{ label }}
    </label>

    <div class="relative">
      <input
        :id="id"
        :value="modelValue"
        :type="type"
        :placeholder="placeholder"
        :autocomplete="autocomplete"
        class="w-full h-12 rounded-xl bg-surface-container border border-outline-variant/30 px-4 pr-11 font-body text-sm text-on-surface placeholder:text-on-surface-variant/60 focus:border-primary focus:ring-1 focus:ring-primary focus:bg-surface-container-lowest transition-colors"
        @input="$emit('update:modelValue', $event.target.value)"
      >

      <span
        v-if="icon"
        class="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant/40 text-[20px] pointer-events-none"
        aria-hidden="true"
      >{{ icon }}</span>
    </div>
  </section>
</template>
