<script setup lang="ts">
import { computed, ref } from 'vue'

const props = defineProps<{
  title: string
  subtitle: string
  count: number
  collapsible?: boolean
}>()

const collapsed = ref(false)
const counter = computed(() => `${props.count} ${props.count === 1 ? 'basket' : 'baskets'}`)
</script>

<template>
  <section>
    <component
      :is="collapsible ? 'button' : 'div'"
      :type="collapsible ? 'button' : undefined"
      :aria-expanded="collapsible ? !collapsed : undefined"
      class="flex w-full items-start justify-between gap-3 px-4 pb-2 pt-4 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-lime"
      @click="collapsible && (collapsed = !collapsed)"
    >
      <span class="min-w-0 border-l-4 border-lime pl-2">
        <h2 class="font-headline text-xl font-bold leading-tight text-primary">{{ title }}</h2>
        <span class="mt-0.5 block font-label text-[10px] font-extrabold uppercase tracking-[0.08em] text-on-surface-variant">{{ subtitle }}</span>
      </span>
      <span class="mt-0.5 inline-flex items-center whitespace-nowrap font-label text-[10px] font-extrabold uppercase tracking-[0.08em] text-on-surface-variant">
        {{ counter }}
        <span v-if="collapsible" class="material-symbols-outlined text-[16px] transition-transform" :class="collapsed ? '-rotate-90' : ''" aria-hidden="true">expand_more</span>
      </span>
    </component>
    <ul v-show="!collapsed" class="grid gap-2.5 px-3">
      <slot />
    </ul>
  </section>
</template>
