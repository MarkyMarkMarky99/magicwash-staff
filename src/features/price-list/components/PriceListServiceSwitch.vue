<script setup lang="ts">
import { computed } from 'vue'
import { priceListServices } from '../utils/price-list-table'

const props = defineProps<{ serviceType: string | null }>()
const emit = defineEmits<{ select: [serviceType: string | null] }>()

const options = [{ key: null, label: 'All', icon: 'apps' }, ...priceListServices]
const activeIndex = computed(() => Math.max(0, options.findIndex((option) => option.key === props.serviceType)))
</script>

<template>
  <div class="pointer-events-none absolute inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-10 flex justify-center">
    <div role="radiogroup" aria-label="Service" class="pointer-events-auto relative grid h-[60px] w-[400px] max-w-[calc(100%-1.5rem)] grid-cols-5 rounded-2xl bg-primary p-1 shadow-[0_8px_16px_-4px_rgba(0,0,0,0.3)]">
      <span
        class="absolute inset-y-1 left-1 w-[calc((100%-0.5rem)/5)] rounded-[12px] bg-lime transition-transform duration-200 motion-reduce:transition-none"
        :style="{ transform: `translateX(${activeIndex * 100}%)` }"
        aria-hidden="true"
      />
      <button
        v-for="(option, index) in options"
        :key="option.label"
        type="button"
        role="radio"
        :aria-checked="index === activeIndex"
        class="relative z-10 flex flex-col items-center justify-center gap-px rounded-[12px] font-label text-[11px] font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime"
        :class="index === activeIndex ? 'text-primary' : 'text-on-primary/60'"
        @click="emit('select', option.key)"
      >
        <span class="material-symbols-outlined text-[22px]" aria-hidden="true">{{ option.icon }}</span>{{ option.label }}
      </button>
    </div>
  </div>
</template>
