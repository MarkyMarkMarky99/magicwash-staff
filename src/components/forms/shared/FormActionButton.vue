<script setup>
const props = defineProps({
  type: { type: String, default: 'button' },
  disabled: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  loadingLabel: { type: String, default: 'Processing' },
  leadingIcon: { type: String, default: '' },
  trailingIcon: { type: String, default: '' },
  size: {
    type: String,
    default: 'md',
    validator: value => ['sm', 'md'].includes(value),
  },
  uppercase: { type: Boolean, default: false },
})

const emit = defineEmits(['click'])

function handleClick(event) {
  if (props.disabled || props.loading) return
  emit('click', event)
}
</script>

<template>
  <button
    :type="type"
    :disabled="disabled || loading"
    class="bg-primary hover:brightness-110 text-on-primary font-headline font-bold shadow-[0_4px_12px_rgba(0,79,69,0.2)] transition-all inline-flex items-center justify-center gap-2 rounded-lg disabled:opacity-70 disabled:cursor-not-allowed active:scale-[0.98]"
    :class="[
      size === 'sm' ? 'h-10 px-4 text-xs' : 'py-3 px-5 text-sm',
      uppercase ? 'uppercase tracking-wide' : '',
    ]"
    @click="handleClick"
  >
    <template v-if="loading">
      <span class="material-symbols-outlined text-[20px] animate-spin" aria-hidden="true">sync</span>
      {{ loadingLabel }}
    </template>
    <template v-else>
      <span v-if="leadingIcon" class="material-symbols-outlined text-[20px]" aria-hidden="true">{{ leadingIcon }}</span>
      <span><slot /></span>
      <span v-if="trailingIcon" class="material-symbols-outlined text-[20px]" aria-hidden="true">{{ trailingIcon }}</span>
    </template>
  </button>
</template>
