<script setup lang="ts" generic="Key extends string">
import type { ReportOption } from './report-types'

defineProps<{ options: ReportOption<Key>[]; active: Key; groupLabel: string }>()
const emit = defineEmits<{ select: [key: Key] }>()
</script>

<template>
  <div
    class="absolute bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 z-10 grid w-[200px] -translate-x-1/2 grid-cols-2 gap-[3px] rounded-full border border-on-primary/10 bg-primary p-[5px] shadow-[0_8px_24px_color-mix(in_srgb,black_35%,transparent)]"
    role="group"
    :aria-label="groupLabel"
  >
    <button
      v-for="option in options"
      :key="option.key"
      type="button"
      :aria-pressed="active === option.key"
      class="min-h-11 rounded-full font-label text-[14px] font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime"
      :class="active === option.key ? 'bg-lime text-on-surface' : 'text-on-primary'"
      @click="emit('select', option.key)"
    >
      {{ option.label }}
    </button>
  </div>
</template>
