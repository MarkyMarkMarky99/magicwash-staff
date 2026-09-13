<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import ListPageLayout from '@/shared/layouts/ListPageLayout.vue'
import GenericTabs from '@/shared/components/GenericTabs.vue'
import ListContainer from '@/shared/components/ListContainer.vue'
import { usePriceListStore } from '../stores/price-list.store'
import PriceListCard from '../components/PriceListCard.vue'
import PriceListOptionsSheet from '../components/PriceListOptionsSheet.vue'
import PriceListServiceFilter from '../components/PriceListServiceFilter.vue'
import PriceListServicePanel from '../components/PriceListServicePanel.vue'
import { usePriceListFilterRoute } from '../composables/usePriceListFilterRoute'
import type { PriceListDto } from '../services/price-list.service'

defineOptions({ name: 'PriceListPage' })

const props = defineProps<{
  embedded?: boolean
}>()

const router = useRouter()
const route = useRoute()
const priceListStore = usePriceListStore()
const { items, loading, error, loaded } = storeToRefs(priceListStore)
const listLoading = computed(() => loading.value && !loaded.value)
const listError = computed(() => (loaded.value ? null : error.value))

const search = ref('')
const serviceFilterOpen = ref(false)
const { filter, updateFilter } = usePriceListFilterRoute()
const selectedCode = computed(() => {
  const raw = route.query.itemCode
  const value = Array.isArray(raw) ? raw[0] : raw
  return typeof value === 'string' && value.trim() ? value.trim() : null
})
let sheetPushedByPage = false
let redirectingAwayFromSheet = false

onBeforeRouteLeave((to) => {
  if (redirectingAwayFromSheet) {
    redirectingAwayFromSheet = false
    return
  }
  if (selectedCode.value === null) return
  sheetPushedByPage = false
  // Replace the sheet entry when leaving this page; the redirected navigation
  // runs this guard once more, then proceeds without leaving the sheet in Back.
  redirectingAwayFromSheet = true
  return { path: to.path, query: to.query, hash: to.hash, replace: true }
})

watch(selectedCode, (code) => {
  if (code === null) sheetPushedByPage = false
})

const itemGroups = computed(() => {
  const groups = new Map<string, typeof items.value>()
  for (const item of items.value) {
    const group = groups.get(item.itemCode)
    if (group) group.push(item)
    else groups.set(item.itemCode, [item])
  }
  return [...groups].map(([itemCode, entries]) => ({ itemCode, items: entries }))
})

const selectedGroup = computed(() => itemGroups.value.find((group) => group.itemCode === selectedCode.value) ?? null)

watch([selectedCode, selectedGroup, loaded], ([code, group, isLoaded]) => {
  if (!code || !isLoaded) return
  if (!group) {
    closeOptions()
    return
  }
  if (group.items.length === 1) void openEdit(group.items[0]!.id)
}, { immediate: true })

const categoryTabs = computed(() => {
  const counts = new Map<string, number>()
  for (const group of itemGroups.value) {
    for (const category of new Set(group.items.map((item) => item.category))) {
      counts.set(category, (counts.get(category) ?? 0) + 1)
    }
  }

  return [
    { key: 'all', label: 'ทั้งหมด', count: itemGroups.value.length },
    ...Array.from(counts, ([category, count]) => ({ key: category, label: category, count })),
  ]
})

const filteredGroups = computed(() => {
  const query = search.value.trim().toLocaleLowerCase('th-TH')

  function matches(item: PriceListDto): boolean {
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
  }

  return itemGroups.value
    .map((group) => ({ ...group, matchingItems: group.items.filter(matches) }))
    .filter((group) => group.matchingItems.length > 0)
})

const activeGroups = computed(() => filteredGroups.value.filter((group) => group.matchingItems.some((item) => item.active)))
const inactiveGroups = computed(() => filteredGroups.value.filter((group) => group.matchingItems.every((item) => !item.active)))

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

function openOptions(itemCode: string) {
  const group = itemGroups.value.find((entry) => entry.itemCode === itemCode)
  if (!group) return
  if (group.items.length === 1) {
    void openEdit(group.items[0]!.id)
    return
  }
  if (selectedCode.value === itemCode) return
  sheetPushedByPage = true
  void router.push({ name: 'price-list', query: { ...route.query, itemCode } })
}

function closeOptions() {
  if (route.name !== 'price-list' || !selectedCode.value) return
  if (sheetPushedByPage) {
    sheetPushedByPage = false
    router.back()
    return
  }
  const query = { ...route.query }
  delete query.itemCode
  void router.replace({ name: 'price-list', query })
}

async function openEdit(id: string) {
  sheetPushedByPage = false
  const query = { ...route.query }
  delete query.itemCode
  await router.replace({ name: 'price-list', query })
  await router.push({ name: 'price-list-edit', params: { id } })
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
      :empty="filteredGroups.length === 0"
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
        v-for="group in activeGroups"
        :key="group.itemCode"
        :item-code="group.itemCode"
        :items="group.items"
        @open="openOptions"
      />

      <PriceListCard
        v-for="group in inactiveGroups"
        :key="group.itemCode"
        :item-code="group.itemCode"
        :items="group.items"
        @open="openOptions"
      />
    </ListContainer>
  </ListPageLayout>
  <PriceListOptionsSheet
    :open="(selectedGroup?.items.length ?? 0) > 1"
    :item-code="selectedCode"
    :items="selectedGroup?.items ?? []"
    :service-type="filter.serviceType"
    @close="closeOptions"
    @select="openEdit"
  />
</template>
