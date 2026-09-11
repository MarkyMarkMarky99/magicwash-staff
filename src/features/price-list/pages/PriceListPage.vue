<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import ListPageLayout from '@/shared/layouts/ListPageLayout.vue'
import GenericTabs from '@/shared/components/GenericTabs.vue'
import ListContainer from '@/shared/components/ListContainer.vue'
import { usePriceListStore } from '../stores/price-list.store'
import PriceListCard from '../components/PriceListCard.vue'
import PriceListServiceFilter from '../components/PriceListServiceFilter.vue'
import PriceListServicePanel from '../components/PriceListServicePanel.vue'
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
const serviceFilterOpen = ref(false)
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
    if (filter.value.serviceType && item.serviceType !== filter.value.serviceType) return false
    if (!query) return true

    return [
      item.itemCode,
      item.category,
      item.subcategory,
      item.itemType,
      item.variant,
      item.displayNameTh,
      item.displayNameEn,
    ]
      .map((value) => String(value ?? '').toLocaleLowerCase('th-TH'))
      .join(' ')
      .includes(query)
  })
})

const activeItems = computed(() => filteredItems.value.filter((item) => item.active))
const inactiveItems = computed(() => filteredItems.value.filter((item) => !item.active))

function selectCategory(key: string) {
  if (!categoryTabs.value.some((tab) => tab.key === key)) return
  updateFilter({ category: key === 'all' ? null : key })
}

function selectService(value: string | null) {
  updateFilter({ serviceType: value })
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
  <ListPageLayout :embedded="props.embedded">
    <template #filters>
      <GenericTabs
        :tabs="categoryTabs"
        :active-key="filter.category ?? 'all'"
        @select="selectCategory"
      />
    </template>

    <ListContainer
      title="รายการราคา"
      icon="sell"
      count-label="รายการ"
      searchable
      :search-value="search"
      search-placeholder="ค้นหารหัส ชื่อ หรือหมวดหมู่"
      @update:search-value="search = $event"
      :loading="listLoading"
      :skeleton-rows="4"
      :error="listError"
      :empty="filteredItems.length === 0"
      empty-text="ไม่พบรายการที่ตรงกับการค้นหา"
    >
      <template #search-actions>
        <PriceListServiceFilter
          v-model:open="serviceFilterOpen"
          :service-type="filter.serviceType"
          :disabled="listLoading"
        />
      </template>

      <template #actions>
        <button
          type="button"
          class="-my-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full text-primary transition-colors hover:bg-primary/10 active:bg-primary/20 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          aria-label="เพิ่มรายการราคา"
          @click="openCreate"
        >
          <span class="material-symbols-outlined text-[16px]" aria-hidden="true">new_label</span>
        </button>
      </template>

      <PriceListServicePanel
        v-if="serviceFilterOpen"
        :service-type="filter.serviceType"
        @select="selectService"
      />

      <template #empty>
        <PriceListServicePanel
          v-if="serviceFilterOpen"
          :service-type="filter.serviceType"
          @select="selectService"
        />
        <p class="px-6 py-4 font-body text-sm italic text-on-surface-variant">ไม่พบรายการที่ตรงกับการค้นหา</p>
      </template>

      <template #error>
        <PriceListServicePanel
          v-if="serviceFilterOpen"
          :service-type="filter.serviceType"
          @select="selectService"
        />
        <p class="px-6 py-4 font-body text-sm text-error">{{ listError }}</p>
      </template>

      <PriceListCard
        v-for="item in activeItems"
        :key="item.id"
        :item="item"
        @edit="openEdit"
      />

      <PriceListCard
        v-for="item in inactiveItems"
        :key="item.id"
        :item="item"
        @edit="openEdit"
      />
    </ListContainer>
  </ListPageLayout>
</template>
