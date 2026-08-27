<script setup lang="ts">
import { computed, onBeforeUnmount, onUnmounted, ref, watch } from 'vue'
import AppLayout from '@/shared/layouts/AppLayout.vue'
import { useHeaderSearch } from '@/shared/composables/useHeaderSearch'

const props = withDefaults(defineProps<{
  searchValue?: string
  searchPlaceholder?: string
  showSearch?: boolean
  searchDebounceMs?: number
  embedded?: boolean
}>(), {
  searchPlaceholder: 'Search…',
  searchDebounceMs: 300,
  embedded: false,
})

const emit = defineEmits<{
  'update:searchValue': [keyword: string]
}>()

const { searchOpen, closeSearch } = useHeaderSearch()
const keywordInput = ref(props.searchValue ?? '')
const searchEnabled = computed(() => props.showSearch ?? props.searchValue !== undefined)
let debounceTimer: ReturnType<typeof setTimeout> | undefined

watch(
  () => props.searchValue,
  (value) => {
    const keyword = value ?? ''
    if (keyword !== keywordInput.value) {
      clearTimeout(debounceTimer)
      keywordInput.value = keyword
    }

    if (keyword) searchOpen.value = true
  },
  { immediate: true },
)

watch(keywordInput, (keyword) => {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    if (keyword !== (props.searchValue ?? '')) emit('update:searchValue', keyword)
  }, props.searchDebounceMs)
})

onBeforeUnmount(() => clearTimeout(debounceTimer))
onUnmounted(() => closeSearch())
</script>

<template>
  <component
    :is="embedded ? 'div' : AppLayout"
    class="h-full flex flex-col relative overflow-hidden font-body text-on-surface w-full"
  >
    <div
      v-if="searchEnabled && searchOpen"
      class="flex-none bg-surface-container px-4 py-2 flex items-center gap-2 border-b border-outline-variant/20"
    >
      <span class="material-symbols-outlined text-on-surface-variant text-[18px] shrink-0" aria-hidden="true">search</span>
      <input
        v-model="keywordInput"
        type="text"
        :placeholder="searchPlaceholder"
        :aria-label="searchPlaceholder"
        class="flex-1 bg-transparent font-body text-sm text-on-surface placeholder:text-on-surface-variant/60 outline-none min-w-0"
        autofocus
      />
      <button
        v-if="keywordInput"
        type="button"
        class="material-symbols-outlined text-on-surface-variant text-[18px] hover:text-on-surface transition-colors shrink-0"
        aria-label="Clear search"
        @click="keywordInput = ''"
      >close</button>
    </div>

    <div v-if="$slots.filters" class="flex-none w-full min-w-0">
      <slot name="filters" />
    </div>

    <main class="min-h-0 flex-1 overflow-y-auto no-scrollbar w-full min-w-0 bg-surface pb-20">
      <slot />
    </main>
  </component>
</template>
