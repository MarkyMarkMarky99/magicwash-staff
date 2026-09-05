<script setup lang="ts">
import { serviceTypeOptions } from '@/shared/utils/service-type-labels'

const props = defineProps<{
  serviceType: string | null
}>()

const emit = defineEmits<{
  select: [value: string | null]
}>()
</script>

<template>
  <!-- Rendered into ListContainer's default, empty AND error slots. ListContainer shows only one
       of them at a time, so a panel placed in just the default slot vanishes the moment the list
       is empty or the load fails — leaving a ?serviceType= in the URL with no way to clear it. -->
  <div class="flex flex-wrap gap-2 bg-surface-container-lowest px-4 py-3">
    <button
      v-for="option in serviceTypeOptions"
      :key="option.value"
      type="button"
      class="rounded-full px-3 py-1 font-label text-[11px] font-semibold transition-colors"
      :class="props.serviceType === option.value
        ? 'bg-primary text-on-primary'
        : 'bg-surface-container text-on-surface-variant hover:text-on-surface'"
      :aria-pressed="props.serviceType === option.value"
      @click="emit('select', props.serviceType === option.value ? null : option.value)"
    >{{ option.label }}</button>
  </div>
</template>
