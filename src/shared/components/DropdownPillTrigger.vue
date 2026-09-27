<script setup lang="ts">
import type { ComponentPublicInstance } from 'vue'

defineProps<{
  label: string
  ariaLabel?: string
  open: boolean
  setTrigger: (element: Element | ComponentPublicInstance | null) => void
  toggle: () => void
  triggerAttrs: { 'aria-controls': string; 'aria-expanded': boolean }
}>()
</script>

<template>
  <button
    :ref="setTrigger"
    v-bind="triggerAttrs"
    type="button"
    class="relative flex h-[22px] items-center gap-1 whitespace-nowrap rounded-full bg-surface-container px-2.5 pr-1.5 font-label text-[9px] font-bold uppercase tracking-wider text-on-surface-variant transition-all after:absolute after:-inset-2 after:content-[''] hover:bg-surface-container-high active:scale-95 focus:outline-none"
    :aria-label="ariaLabel ?? label"
    @click="toggle"
  >
    {{ label }}
    <span class="material-symbols-outlined text-[14px] leading-none transition-transform" :class="open ? 'rotate-180' : ''" aria-hidden="true">expand_more</span>
  </button>
</template>
