<script setup lang="ts">
import AppLayout from '@/shared/layouts/AppLayout.vue'

// Search moved into ListContainer, where the magnifier now sits in the list heading and the
// input drops in under it. This layout owns page chrome only: the filter strip and the scroll
// region. Do not put a page-wide search bar back here.
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

    <main class="min-h-0 flex-1 overflow-y-auto overflow-x-hidden no-scrollbar w-full min-w-0 bg-surface pb-20">
      <slot />
    </main>
  </component>
</template>
