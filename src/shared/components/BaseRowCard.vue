<script setup lang="ts">
import type { PropType } from 'vue'

defineProps({
  line1: { type: String, required: true },
  line2: { type: String, default: '' },
  line3: { type: String, default: '' },
  density: {
    type: String as PropType<'compact' | 'roomy'>,
    default: 'compact',
  },
})
</script>

<template>
  <div :class="['flex gap-3 px-4', density === 'roomy' ? 'py-4' : 'py-3']">
    <div v-if="$slots.lead" class="shrink-0">
      <slot name="lead" />
    </div>
    <div class="min-w-0 flex-grow space-y-0.5">
      <h3 class="truncate font-headline text-[14px] font-bold leading-tight text-primary">
        <slot name="line1">{{ line1 }}</slot>
      </h3>
      <p v-if="line2 || $slots.line2" class="truncate font-body text-xs text-on-surface-variant">
        <slot name="line2">{{ line2 }}</slot>
      </p>
      <p v-if="line3 || $slots.line3" class="truncate font-body text-xs text-on-surface-variant">
        <slot name="line3">{{ line3 }}</slot>
      </p>
    </div>
    <div
      v-if="$slots['top-end'] || $slots['bot-end']"
      class="flex shrink-0 flex-col items-end justify-between gap-1"
    >
      <slot name="top-end" />
      <slot name="bot-end" />
    </div>
  </div>
</template>
