<script setup lang="ts">
import AppLayout from '@/shared/layouts/AppLayout.vue'
import ScrollRegion from '@/shared/components/ScrollRegion.vue'

// Search belongs to ListContainer; this layout owns the filter strip and scroll region only.
const props = withDefaults(defineProps<{
  embedded?: boolean
}>(), {
  embedded: false,
})
</script>

<template>
  <component
    :is="embedded ? 'div' : AppLayout"
    class="h-full flex flex-col relative overflow-hidden font-body text-on-surface w-full"
  >
    <div v-if="$slots.filters" class="flex-none w-full min-w-0">
      <slot name="filters" />
    </div>

    <ScrollRegion as="main" class="w-full min-w-0 bg-surface pb-20">
      <slot />
    </ScrollRegion>
  </component>
</template>
