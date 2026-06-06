<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  title: { type: String, required: true },
  icon: { type: String, required: true },
  count: { type: Number, default: 0 },
  countLabel: { type: String, default: '' },
  collapsible: { type: Boolean, default: false },
})

const collapsed = ref(false)
const headingId = computed(() =>
  `${props.title.toLowerCase().replace(/\s+/g, '-')}-heading`
)

const contentVisible = computed(() => !props.collapsible || !collapsed.value)

function toggleCollapsed() {
  if (!props.collapsible) return
  collapsed.value = !collapsed.value
}
</script>

<template>
  <section :aria-labelledby="headingId" class="bg-surface-container-lowest border border-outline-variant/25 rounded-lg overflow-hidden">
    <div
      :id="headingId"
      class="px-4 py-2 bg-surface-container-low border-b border-outline-variant/20 text-primary flex items-center justify-between transition-colors"
      :class="[
        collapsible ? 'cursor-pointer select-none' : '',
      ]"
      @click="toggleCollapsed"
    >
      <div class="flex items-center gap-2.5">
        <span class="material-symbols-outlined text-primary text-[16px]" aria-hidden="true">{{ icon }}</span>
        <h2 class="font-headline font-bold text-[13px] tracking-tight">{{ title }}</h2>
      </div>

      <div class="flex items-center gap-2">
        <div v-if="countLabel" class="flex items-center gap-1.5 bg-surface-container rounded-full px-2.5 py-1">
          <span class="font-label text-[9px] text-on-surface-variant font-bold uppercase tracking-wider">
            {{ count }} {{ countLabel }}
          </span>
        </div>
        <slot name="actions" />
        <span
          v-if="collapsible"
          class="material-symbols-outlined text-primary text-[16px] transition-transform duration-200"
          :class="collapsed ? '-rotate-90' : ''"
          aria-hidden="true"
        >expand_more</span>
      </div>
    </div>

    <template v-if="contentVisible">
      <slot />
    </template>
  </section>
</template>
