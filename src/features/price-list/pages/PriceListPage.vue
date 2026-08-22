<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, onUnmounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import AppLayout from '@/shared/layouts/AppLayout.vue'
import GenericTabs from '@/shared/components/GenericTabs.vue'
import ListContainer from '@/shared/components/ListContainer.vue'
import { useHeaderSearch } from '@/shared/composables/useHeaderSearch'
import { usePriceListStore } from '../stores/price-list.store'
import PriceListCard from '../components/PriceListCard.vue'

defineOptions({ name: 'PriceListPage' })

const props = defineProps<{
  embedded?: boolean
}>()

const router = useRouter()
const priceListStore = usePriceListStore()
const { items, loading, error, loaded } = storeToRefs(priceListStore)
const { searchOpen, closeSearch } = useHeaderSearch()

const layoutComponent = computed(() => (props.embedded ? 'div' : AppLayout))
const listLoading = computed(() => loading.value && !loaded.value)
const listError = computed(() => (loaded.value ? null : error.value))

const search = ref('')
const keywordInput = ref(search.value)
const selectedCategory = ref('all')

const categoryTabs = computed(() => {
  const counts = new Map<string, number>()
  for (const item of items.value) {
    counts.set(item.category, (counts.get(item.category) ?? 0) + 1)
  }

  return [
    { key: 'all', label: 'ทั้งหมด', count: items.value.length },
    ...Array.from(counts, ([category, count]) => ({ key: category, label: category, count })),
  ]
})

const filteredItems = computed(() => {
  const query = search.value.trim().toLocaleLowerCase('th-TH')

  return items.value.filter((item) => {
    if (selectedCategory.value !== 'all' && item.category !== selectedCategory.value) return false
    if (!query) return true

    return [
      item.itemCode,
      item.category,
      item.subcategory,
      item.itemType,
      item.variant,
      item.displayNameTh,
    ]
      .map((value) => String(value ?? '').toLocaleLowerCase('th-TH'))
      .join(' ')
      .includes(query)
  })
})

function selectCategory(key: string) {
  if (categoryTabs.value.some((tab) => tab.key === key)) selectedCategory.value = key
}

const SEARCH_DEBOUNCE_MS = 250
let debounceTimer: ReturnType<typeof setTimeout> | undefined

watch(search, (value) => {
  if (value !== keywordInput.value) keywordInput.value = value
})

watch(keywordInput, (value) => {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    if (value !== search.value) search.value = value
  }, SEARCH_DEBOUNCE_MS)
})

function clearSearch() {
  keywordInput.value = ''
  clearTimeout(debounceTimer)
  if (search.value) search.value = ''
}

function openCreate() {
  void router.push({ name: 'price-list-create' })
}

function openEdit(id: string) {
  void router.push({ name: 'price-list-edit', params: { id } })
}

onMounted(() => {
  void priceListStore.load()
  if (search.value) searchOpen.value = true
})

onBeforeUnmount(() => clearTimeout(debounceTimer))
onUnmounted(() => closeSearch())
</script>

<template>
  <component :is="layoutComponent" class="h-full flex flex-col relative overflow-hidden font-body text-on-surface w-full">
    <div class="flex-none bg-primary text-on-primary w-full min-w-0">
      <GenericTabs :tabs="categoryTabs" :active-key="selectedCategory" @select="selectCategory" />
    </div>

    <div
      v-if="searchOpen"
      class="flex-none bg-surface-container px-4 py-2 flex items-center gap-2 border-b border-outline-variant/20"
    >
      <span class="material-symbols-outlined text-on-surface-variant text-[18px] shrink-0" aria-hidden="true">search</span>
      <label class="sr-only" for="price-list-search">ค้นหารายการราคา</label>
      <input
        id="price-list-search"
        v-model="keywordInput"
        type="text"
        placeholder="ค้นหารหัส ชื่อ หรือหมวดหมู่"
        autocomplete="off"
        class="flex-1 bg-transparent font-body text-sm text-on-surface placeholder:text-on-surface-variant/60 outline-none min-w-0"
        autofocus
      >
      <button
        v-if="keywordInput"
        type="button"
        class="material-symbols-outlined text-on-surface-variant text-[18px] hover:text-on-surface transition-colors shrink-0"
        aria-label="ล้างคำค้นหา"
        @click="clearSearch"
      >close</button>
    </div>

    <main class="flex-1 overflow-y-auto no-scrollbar pb-20 w-full bg-surface min-w-0">
      <ListContainer
        title="รายการราคา"
        icon="sell"
        count-label="รายการ"
        :loading="listLoading"
        :skeleton-rows="4"
        :error="listError"
        :empty="filteredItems.length === 0"
        empty-text="ไม่พบรายการที่ตรงกับการค้นหา"
      >
        <template #actions>
          <button
            class="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-primary px-2.5 py-1 font-label text-[11px] font-bold text-on-primary shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:bg-surface-container-high disabled:text-on-surface-variant disabled:shadow-none"
            type="button"
            @click="openCreate"
          >
            <span class="material-symbols-outlined text-[16px]" aria-hidden="true">add</span>
            <span>เพิ่มรายการ</span>
          </button>
        </template>

        <PriceListCard
          v-for="item in filteredItems"
          :key="item.id"
          :item="item"
          @edit="openEdit"
        />
      </ListContainer>
    </main>
  </component>
</template>
