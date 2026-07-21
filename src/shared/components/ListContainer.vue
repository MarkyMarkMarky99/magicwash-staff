<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  title: { type: String, required: true },
  icon: { type: String, required: true },
  count: { type: Number, default: 0 },
  countLabel: { type: String, required: true },
  topDivider: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  error: { type: String, default: null },
  empty: { type: Boolean, default: false },
  emptyText: { type: String, default: 'No items' },
  collapsible: { type: Boolean, default: false },
  skeletonRows: { type: Number, default: 0 },
  skeletonAvatarClass: { type: String, default: 'w-10 h-10' },
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
  <section :aria-labelledby="headingId" class="bg-white w-full">
    <div
      :id="headingId"
      class="px-4 py-2 bg-surface-container-low text-primary flex items-center justify-between transition-colors"
      :class="[
        topDivider ? 'border-t border-outline-variant/30' : '',
        collapsible ? 'cursor-pointer select-none' : '',
      ]"
      @click="toggleCollapsed"
    >
      <div class="flex items-center gap-2.5">
        <span class="material-symbols-outlined text-primary text-[16px]" aria-hidden="true">{{ icon }}</span>
        <h2 class="font-headline font-bold text-[13px] tracking-tight">{{ title }}</h2>
      </div>

      <div class="flex items-center gap-2">
        <div class="flex items-center gap-1.5 bg-surface-container rounded-full px-2.5 py-1">
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
      <slot v-if="loading" name="loading">
        <div class="divide-y divide-outline-variant/10">
          <div v-for="i in skeletonRows" :key="i" class="px-4 py-4 flex gap-3 animate-pulse">
            <div :class="[skeletonAvatarClass, 'rounded-full bg-surface-container shrink-0']" />
            <div class="flex-grow flex flex-col gap-2 justify-center">
              <div class="h-4 bg-surface-container rounded w-3/4" />
              <div class="h-3 bg-surface-container rounded w-1/2" />
            </div>
          </div>
        </div>
      </slot>

      <slot v-else-if="error" name="error">
        <p class="px-6 py-4 text-sm text-error">{{ error }}</p>
      </slot>

      <slot v-else-if="empty" name="empty">
        <p class="px-6 py-4 text-sm text-on-surface-variant italic">
          {{ emptyText }}
        </p>
      </slot>

      <div v-else class="divide-y divide-outline-variant/10">
        <slot />
      </div>
    </template>
  </section>
</template>
