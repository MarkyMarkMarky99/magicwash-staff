<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps({
  title: { type: String, required: true },
  icon: { type: String, required: true },
  count: { type: Number, required: false },
  countLabel: { type: String, required: true },
  topDivider: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  // PropType cast: the default is null, so the prop genuinely accepts null and
  // every caller passes a nullable store error. Without it Vue infers
  // `string | undefined` and each call site is a type error.
  error: { type: /** @type {import('vue').PropType<string | null>} */ (String), default: null },
  empty: { type: Boolean, default: false },
  emptyText: { type: String, default: 'No items' },
  collapsible: { type: Boolean, default: false },
  skeletonRows: { type: Number, default: 0 },
  skeletonAvatarClass: { type: String, default: 'w-10 h-10' },
  // Search is opt-in. Several screens render more than one ListContainer at once (the
  // appointment schedule shows four, customer detail swaps three sections), and a magnifier
  // on each of them would be nonsense -- only a page's main browse list asks for one.
  searchable: { type: Boolean, default: false },
  searchValue: { type: String, default: undefined },
  searchPlaceholder: { type: String, default: 'ค้นหา…' },
  searchDebounceMs: { type: Number, default: 300 },
})

const emit = defineEmits(['update:searchValue'])

const collapsed = ref(false)
const searchOpen = ref(Boolean(props.searchValue))
const keywordInput = ref(props.searchValue ?? '')
let debounceTimer

watch(
  () => props.searchValue,
  (value) => {
    const keyword = value ?? ''
    if (keyword !== keywordInput.value) {
      clearTimeout(debounceTimer)
      keywordInput.value = keyword
    }
    // A keyword arriving from the URL (a deep link, a restored filter) has to reveal the box
    // it came from, or the user sees a filtered list with no visible reason.
    if (keyword) searchOpen.value = true
  },
)

watch(keywordInput, (keyword) => {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    if (keyword !== (props.searchValue ?? '')) emit('update:searchValue', keyword)
  }, props.searchDebounceMs)
})

onBeforeUnmount(() => clearTimeout(debounceTimer))

function toggleSearch() {
  searchOpen.value = !searchOpen.value
}
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
        <div v-if="count !== undefined" class="flex items-center gap-1.5 bg-surface-container rounded-full px-2.5 py-1">
          <span class="font-label text-[9px] text-on-surface-variant font-bold uppercase tracking-wider">
            {{ count }} {{ countLabel }}
          </span>
        </div>
        <button
          v-if="searchable"
          type="button"
          class="-my-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          :class="searchOpen || keywordInput ? 'bg-primary/10 text-primary' : 'text-primary hover:bg-primary/10 active:bg-primary/20'"
          :aria-label="searchOpen ? 'ปิดการค้นหา' : 'ค้นหา'"
          :aria-expanded="searchOpen"
          @click.stop="toggleSearch"
        >
          <span class="material-symbols-outlined text-[16px]" aria-hidden="true">search</span>
        </button>

        <slot name="actions" />
        <span
          v-if="collapsible"
          class="material-symbols-outlined text-primary text-[16px] transition-transform duration-200"
          :class="collapsed ? '-rotate-90' : ''"
          aria-hidden="true"
        >expand_more</span>
      </div>
    </div>

    <div
      v-if="searchable && searchOpen"
      class="flex items-center gap-2 border-b border-outline-variant/20 bg-surface-container px-4 py-2"
    >
      <span class="material-symbols-outlined shrink-0 text-[18px] text-on-surface-variant" aria-hidden="true">search</span>
      <input
        v-model="keywordInput"
        type="text"
        :placeholder="searchPlaceholder"
        :aria-label="searchPlaceholder"
        class="min-w-0 flex-1 bg-transparent font-body text-sm text-on-surface outline-none placeholder:text-on-surface-variant/60"
      />
      <button
        v-if="keywordInput"
        type="button"
        class="material-symbols-outlined shrink-0 text-[18px] text-on-surface-variant transition-colors hover:text-on-surface"
        aria-label="ล้างคำค้นหา"
        @click="keywordInput = ''"
      >close</button>
      <!-- Filter triggers ride at the right edge of the search row, not in a strip of their own. -->
      <slot name="search-actions" />
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
