<script setup lang="ts">
import { computed, onMounted, ref, useId, watch } from 'vue'

const props = defineProps<{ percentage: number; completed: number; total: number; label: string }>()

const id = useId()
const shown = ref(0)
const angle = computed(() => shown.value * 3.6)
const labelSize = computed(() => props.label.length <= 4 ? 'text-[30px]' : props.label.length <= 6 ? 'text-[22px]' : 'text-[16px]')

onMounted(() => requestAnimationFrame(() => { shown.value = props.percentage }))
watch(() => props.percentage, value => { shown.value = value })
</script>

<template>
  <span class="relative flex h-[164px] w-[164px] items-center justify-center">
    <svg viewBox="0 0 100 100" class="absolute inset-0 h-full w-full -rotate-90" aria-hidden="true">
      <circle cx="50" cy="50" r="43" fill="none" stroke="currentColor" stroke-width="13" class="text-secondary/15" />
      <circle cx="50" cy="50" r="43" fill="none" stroke="currentColor" stroke-width="13" stroke-linecap="round" pathLength="100" :stroke-dasharray="`${shown} 100`" class="ring-motion text-secondary" :class="shown > 0 ? 'opacity-100' : 'opacity-0'" />
    </svg>
    <span class="absolute inset-[18%] rounded-full bg-surface-container-lowest shadow-[0_2px_10px_rgba(0,0,0,0.12)]" aria-hidden="true" />
    <svg viewBox="0 0 100 100" class="absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
      <defs>
        <path :id="`${id}-top`" d="M 27 50 A 23 23 0 0 1 73 50" />
        <path :id="`${id}-bottom`" d="M 22 50 A 28 28 0 0 0 78 50" />
      </defs>
      <text class="fill-on-surface-variant font-label" font-size="6" font-weight="600" letter-spacing="0.3"><textPath :href="`#${id}-top`" startOffset="50%" text-anchor="middle">Completed</textPath></text>
      <text class="fill-secondary font-label" font-size="6.5" font-weight="700" letter-spacing="0.2"><textPath :href="`#${id}-bottom`" startOffset="50%" text-anchor="middle">{{ completed }} of {{ total }}</textPath></text>
    </svg>
    <span class="relative max-w-[96px] truncate font-headline font-semibold leading-none tracking-tight text-on-surface" :class="labelSize">{{ label }}</span>
    <span class="ring-motion pointer-events-none absolute inset-0" :style="{ transform: `rotate(${angle}deg)` }">
      <span class="absolute left-1/2 top-[7%] -translate-x-1/2 -translate-y-1/2">
        <span class="ring-motion flex h-[22px] min-w-[40px] items-center justify-center rounded-full bg-primary px-2 font-label text-[11px] font-bold leading-none text-on-primary shadow-[0_1px_4px_rgba(0,0,0,0.25)]" :style="{ transform: `rotate(${-angle}deg)` }">{{ percentage }}%</span>
      </span>
    </span>
  </span>
</template>

<style scoped>
.ring-motion {
  transition: stroke-dasharray 700ms cubic-bezier(0.22, 1, 0.36, 1), transform 700ms cubic-bezier(0.22, 1, 0.36, 1), opacity 150ms linear;
}

@media (prefers-reduced-motion: reduce) {
  .ring-motion {
    transition: none;
  }
}
</style>
