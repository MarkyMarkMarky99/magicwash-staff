<script setup lang="ts">
import { ref } from 'vue'

defineProps<{
  title: string
  subtitle: string
  collapsible?: boolean
  framed?: boolean
}>()

const collapsed = ref(false)
</script>

<template>
  <section>
    <div class="flex items-start gap-3 px-4 pb-2 pt-4">
      <component
        :is="collapsible ? 'button' : 'div'"
        :type="collapsible ? 'button' : undefined"
        :aria-expanded="collapsible ? !collapsed : undefined"
        class="flex min-w-0 flex-1 items-start justify-between gap-3 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-lime"
        @click="collapsible && (collapsed = !collapsed)"
      >
        <span class="min-w-0 border-l-4 border-lime pl-2">
          <h2 class="font-headline text-xl font-bold leading-tight text-primary">{{ title }}</h2>
          <span class="mt-0.5 block font-label text-[10px] font-extrabold uppercase tracking-[0.08em] text-on-surface-variant">{{ subtitle }}</span>
        </span>
        <span v-if="collapsible" class="material-symbols-outlined mt-0.5 text-[16px] text-on-surface-variant transition-transform" :class="collapsed ? '-rotate-90' : ''" aria-hidden="true">expand_more</span>
      </component>
      <div v-if="$slots.action" class="-mt-1 shrink-0">
        <slot name="action" />
      </div>
    </div>
    <ul v-show="!collapsed" class="grid" :class="framed ? 'gap-6 pb-1 pl-3 pr-4 pt-3' : 'gap-2.5 px-3'">
      <slot />
    </ul>
  </section>
</template>
