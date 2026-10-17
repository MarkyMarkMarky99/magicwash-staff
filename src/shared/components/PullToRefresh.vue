<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { usePullToRefresh } from '@/shared/composables/use-pull-to-refresh'
import { pullProgress, pullRadius } from '@/shared/utils/pull-to-refresh'
import ScrollRegion from './ScrollRegion.vue'

defineOptions({ inheritAttrs: false })

const props = defineProps<{ refresh: () => Promise<void>; inline?: boolean }>()

const region = ref<InstanceType<typeof ScrollRegion> | null>(null)
const root = ref<HTMLElement | null>(null)
const body = ref<HTMLElement | null>(null)
const ancestorScroller = ref<HTMLElement | null>(null)
const target = computed(() => props.inline ? body.value : region.value?.el ?? null)
const scroller = computed(() => props.inline ? ancestorScroller.value : target.value)
const { offset, phase } = usePullToRefresh(target, () => props.refresh(), scroller)

onMounted(() => {
  if (!props.inline) return
  let ancestor = root.value?.parentElement ?? null
  while (ancestor) {
    const overflowY = getComputedStyle(ancestor).overflowY
    if (overflowY === 'auto' || overflowY === 'scroll') {
      ancestorScroller.value = ancestor
      return
    }
    ancestor = ancestor.parentElement
  }
  ancestorScroller.value = document.scrollingElement as HTMLElement | null
})

const pulling = computed(() => phase.value === 'pulling')
const spinning = computed(() => phase.value === 'refreshing' || phase.value === 'closing')
const bodyStyle = computed(() => {
  const radius = `${pullRadius(offset.value)}px`
  return {
    transform: offset.value > 0 ? `translateY(${offset.value}px)` : undefined,
    borderTopLeftRadius: radius,
    borderTopRightRadius: radius,
  }
})
const iconStyle = computed(() => ({ '--pull-rotation': `${pullProgress(offset.value) * 360}deg` }))
</script>

<template>
  <div ref="root" class="relative overflow-hidden bg-primary" :class="{ 'flex min-h-0 flex-1 flex-col': !inline }">
    <div
      class="pull-gap pointer-events-none absolute inset-x-0 top-0 flex items-center justify-center overflow-hidden text-lime"
      :class="{ 'pull-settle': !pulling }"
      :style="{ height: `${offset}px` }"
      aria-hidden="true"
    >
      <span v-if="spinning" class="material-symbols-outlined text-[28px] motion-safe:animate-spin">progress_activity</span>
      <span v-else class="pull-icon material-symbols-outlined text-[28px]" :style="iconStyle">refresh</span>
    </div>
    <div
      v-if="inline"
      ref="body"
      class="pull-body bg-white"
      :class="{ 'pull-settle': !pulling, 'select-none': pulling }"
      :style="bodyStyle"
    >
      <slot />
    </div>
    <ScrollRegion
      v-else
      ref="region"
      v-bind="$attrs"
      class="pull-body"
      :class="{ 'pull-settle': !pulling, 'select-none': pulling }"
      :style="bodyStyle"
    >
      <slot />
    </ScrollRegion>
    <span class="sr-only" role="status">{{ spinning ? 'Refreshing' : '' }}</span>
  </div>
</template>

<style scoped>
.pull-settle.pull-gap {
  transition: height 250ms ease-out;
}

.pull-settle.pull-body {
  transition: transform 250ms ease-out, border-radius 250ms ease-out;
}

.pull-icon {
  transform: rotate(var(--pull-rotation));
}

@media (prefers-reduced-motion: reduce) {
  .pull-settle.pull-gap,
  .pull-settle.pull-body {
    transition: none;
  }

  .pull-icon {
    transform: none;
  }
}
</style>
