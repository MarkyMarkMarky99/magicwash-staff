<script setup lang="ts">
import { washQueueTagCodes } from '@contracts/wash-queue/wash-queue-api.schema'
import ScrollRegion from '@/shared/components/ScrollRegion.vue'

defineProps<{ modelValue: string | null }>()
const emit = defineEmits<{ 'update:modelValue': [tagCode: string] }>()
</script>

<template>
  <div class="pb-4">
    <div class="mb-2 flex items-baseline justify-between border-l-4 border-lime pl-2">
      <span id="wash-queue-tag-label" class="font-body text-[11px] font-extrabold uppercase tracking-wider text-on-surface-variant">Tag</span>
      <span v-if="modelValue" class="font-label text-[11px] text-primary">Tag {{ modelValue }}</span>
      <span v-else class="font-label text-[11px] text-warning">Required</span>
    </div>
    <ScrollRegion axis="x" sizing="auto" role="radiogroup" aria-labelledby="wash-queue-tag-label" class="-mx-1 flex gap-[9px] px-1 py-0.5">
      <button
        v-for="code in washQueueTagCodes"
        :key="code"
        type="button"
        role="radio"
        :aria-checked="modelValue === code"
        class="flex h-[46px] w-[46px] flex-none items-center justify-center rounded-[11px_13px_11px_12px] border-2 font-headline text-lg font-extrabold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime"
        :class="modelValue === code ? 'border-primary bg-primary text-lime shadow-[3px_3px_0_color-mix(in_srgb,var(--color-primary)_70%,black)] -translate-x-px -translate-y-px' : 'border-outline-variant bg-white text-primary shadow-[2px_2px_0_var(--color-outline-variant)]'"
        @click="emit('update:modelValue', code)"
      >{{ code }}</button>
    </ScrollRegion>
  </div>
</template>
