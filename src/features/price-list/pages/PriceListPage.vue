<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import ListPageLayout from '@/shared/layouts/ListPageLayout.vue'
import GenericTabs from '@/shared/components/GenericTabs.vue'
import ListContainer from '@/shared/components/ListContainer.vue'
import { usePriceListStore } from '../stores/price-list.store'
import PriceListCard from '../components/PriceListCard.vue'
import { usePriceListFilterRoute } from '../composables/usePriceListFilterRoute'

defineOptions({ name: 'PriceListPage' })

const props = defineProps<{
  embedded?: boolean
}>()

const router = useRouter()
const priceListStore = usePriceListStore()
const { items, loading, error, loaded } = storeToRefs(priceListStore)
const listLoading = computed(() => loading.value && !loaded.value)
const listError = computed(() => (loaded.value ? null : error.value))

const search = ref('')
const { filter, updateFilter } = usePriceListFilterRoute()

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
    if ((filter.value.category ?? 'all') !== 'all' && item.category !== filter.value.category) return false
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
  if (categoryTabs.value.some((tab) => tab.key === key)) {
    updateFilter({ category: key === 'all' ? null : key })
  }
}

function openCreate() {
  void router.push({
    name: 'price-list-create',
    query: filter.value.category ? { category: filter.value.category } : {},
  })
}

function openEdit(id: string) {
  void router.push({ name: 'price-list-edit', params: { id } })
}

onMounted(() => {
  void priceListStore.load()
})
</script>

<template>
  <ListPageLayout
    :embedded="props.embedded"
    :search-value="search"
    search-placeholder="ค้นหารหัส ชื่อ หรือหมวดหมู่"
    @update:search-value="search = $event"
  >
    <template #filters>
      <div class="flex-none bg-primary text-on-primary w-full min-w-0">
      <GenericTabs :tabs="categoryTabs" :active-key="filter.category ?? 'all'" @select="selectCategory" />
      </div>
    </template>

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
  </ListPageLayout>
</template>
