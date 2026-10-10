<script setup lang="ts">
import { washQueueTagCodes } from '@contracts/wash-queue/wash-queue-api.schema'
import ScrollRegion from '@/shared/components/ScrollRegion.vue'

defineProps<{ modelValue: string | null }>()
const emit = defineEmits<{ 'update:modelValue': [tagCode: string] }>()
</script>

<template>
  <div class="pb-4">
    <div class="mb-1.5 flex items-baseline justify-between">
      <span id="wash-queue-tag-label" class="font-body text-xs font-bold text-on-surface">Tag</span>
      <span v-if="!modelValue" class="font-label text-[11px] text-on-surface-variant">Required</span>
    </div>
    <ScrollRegion axis="x" sizing="auto" role="radiogroup" aria-labelledby="wash-queue-tag-label" class="-mx-1 flex gap-1.5 px-1 py-0.5">
      <button
        v-for="code in washQueueTagCodes"
        :key="code"
        type="button"
        role="radio"
        :aria-checked="modelValue === code"
        class="flex h-11 w-11 flex-none items-center justify-center rounded-[10px] border font-headline text-lg font-extrabold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime"
        :class="modelValue === code ? 'border-primary bg-primary text-white' : 'border-outline-variant bg-white text-primary'"
        @click="emit('update:modelValue', code)"
      >{{ code }}</button>
    </ScrollRegion>
  </div>
</template>
