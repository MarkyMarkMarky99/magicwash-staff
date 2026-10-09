<script setup lang="ts">
withDefaults(defineProps<{
  label: string
  variant?: 'primary' | 'quiet'
  large?: boolean
  busy?: boolean
  disabled?: boolean
}>(), { variant: 'primary', large: false, busy: false, disabled: false })
defineEmits<{ click: [] }>()
</script>

<template>
  <button
    type="button"
    class="flex items-center justify-center gap-2 rounded-full px-5 font-label text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime disabled:opacity-50"
    :class="[large ? 'h-12' : 'h-11', variant === 'primary' ? 'bg-primary font-bold text-on-primary' : 'border border-outline-variant text-on-surface-variant']"
    :disabled="busy || disabled"
    @click="$emit('click')"
  >
    <span v-if="busy" class="material-symbols-outlined animate-spin text-[18px]" aria-hidden="true">sync</span>
    {{ label }}
  </button>
</template>
