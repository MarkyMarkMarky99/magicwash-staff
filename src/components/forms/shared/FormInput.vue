<script setup>
import { computed } from 'vue'

const props = defineProps({
  id:           { type: String, required: true },
  label:        { type: String, required: true },
  modelValue:   { type: String, default: '' },
  type:         { type: String, default: 'text' },
  placeholder:  { type: String, default: '' },
  icon:         { type: String, default: '' },
  autocomplete: { type: String, default: undefined },
  labelVariant: {
    type: String,
    default: 'default',
    validator: value => ['default', 'compact'].includes(value),
  },
  iconPosition: {
    type: String,
    default: 'right',
    validator: value => ['left', 'right'].includes(value),
  },
  size: {
    type: String,
    default: 'md',
    validator: value => ['sm', 'md'].includes(value),
  },
  uppercase: { type: Boolean, default: false },
})

defineEmits(['update:modelValue', 'enter'])

const labelClasses = computed(() => [
  'font-bold block',
  props.labelVariant === 'compact'
    ? 'text-[11px] text-on-surface-variant uppercase tracking-wide'
    : 'font-headline text-base text-primary',
])

const inputClasses = computed(() => [
  'w-full bg-surface-container border font-body text-sm text-on-surface placeholder:text-on-surface-variant/60 focus:border-primary focus:ring-1 focus:ring-primary focus:bg-surface-container-lowest transition-colors',
  props.size === 'sm'
    ? 'h-10 rounded-lg border-outline-variant/40 px-3'
    : 'h-12 rounded-xl border-outline-variant/30 px-4',
  props.icon && props.iconPosition === 'left' ? 'pl-9' : 'pr-11',
  props.uppercase ? 'uppercase placeholder:normal-case' : '',
])

const iconClasses = computed(() => [
  'material-symbols-outlined absolute top-1/2 -translate-y-1/2 text-on-surface-variant/40 text-[20px] pointer-events-none',
  props.iconPosition === 'left' ? 'left-3' : 'right-3',
])
</script>

<template>
  <section class="space-y-2">
    <label :for="id" :class="labelClasses">
      {{ label }}
    </label>

    <div class="relative">
      <input
        :id="id"
        :value="modelValue"
        :type="type"
        :placeholder="placeholder"
        :autocomplete="autocomplete"
        :class="inputClasses"
        @input="$emit('update:modelValue', $event.target.value)"
        @keydown.enter.prevent="$emit('enter')"
      >

      <span
        v-if="icon"
        :class="iconClasses"
        aria-hidden="true"
      >{{ icon }}</span>
    </div>
  </section>
</template>
