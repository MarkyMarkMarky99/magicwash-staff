<script setup lang="ts">
import { ref } from 'vue'

type ScrollAxis = 'y' | 'x'
type ScrollSizing = 'fill' | 'auto'
type ScrollOverscroll = 'contain' | 'auto'

const props = withDefaults(defineProps<{
  as?: string
  axis?: ScrollAxis
  sizing?: ScrollSizing
  overscroll?: ScrollOverscroll
}>(), {
  as: 'div',
  axis: 'y',
  sizing: 'fill',
  overscroll: 'contain',
})

const el = ref<HTMLElement | null>(null)

defineExpose({ el })
</script>

<template>
  <component
    :is="props.as"
    ref="el"
    class="no-scrollbar"
    :class="[
      props.axis === 'y' ? 'overflow-y-auto overflow-x-hidden' : 'overflow-x-auto overflow-y-hidden',
      props.sizing === 'fill' ? 'min-h-0 flex-1' : '',
      props.overscroll === 'contain' ? 'overscroll-contain' : 'overscroll-auto',
    ]"
  >
    <slot />
  </component>
</template>
