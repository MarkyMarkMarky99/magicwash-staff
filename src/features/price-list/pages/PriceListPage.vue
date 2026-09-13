<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import ListPageLayout from '@/shared/layouts/ListPageLayout.vue'
import GenericTabs from '@/shared/components/GenericTabs.vue'
import ListContainer from '@/shared/components/ListContainer.vue'
import ScrollRegion from '@/shared/components/ScrollRegion.vue'
import ImageOrIcon from '@/shared/components/ImageOrIcon.vue'
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
const categoryOrder = ['CLOTHING', 'BEDDING', 'HOUSEHOLD', 'OTHERS']
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
    if (!item.active) continue
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
  for (const item of items.value) counts.set(item.category.toUpperCase(), 0)
  for (const group of itemGroups.value) {
    for (const category of new Set(group.items.map((item) => item.category.toUpperCase()))) {
      counts.set(category, (counts.get(category) ?? 0) + 1)
    }
  }

  return [
    { key: 'ALL', label: 'ALL', count: itemGroups.value.length },
    ...Array.from(counts.keys())
      .sort((a, b) => {
        const aOrder = categoryOrder.indexOf(a)
        const bOrder = categoryOrder.indexOf(b)
        if (aOrder !== bOrder) return (aOrder < 0 ? Infinity : aOrder) - (bOrder < 0 ? Infinity : bOrder)
        return a.localeCompare(b, 'th-TH')
      })
      .map((category) => ({ key: category, label: category, count: counts.get(category)! })),
  ]
})

const subcategoryTabs = computed(() => {
  if (filter.value.category === 'ALL') return []

  const counts = new Map<string, number>()
  const images = new Map<string, string>()
  let categoryCount = 0
  for (const group of itemGroups.value) {
    const categoryItems = group.items.filter((item) => item.category.toUpperCase() === filter.value.category)
    if (categoryItems.length) categoryCount++
    for (const item of categoryItems) {
      if (item.subcategory?.trim() && item.imageUrl && !images.has(item.subcategory)) {
        images.set(item.subcategory, item.imageUrl)
      }
    }
    const subcategories = new Set(categoryItems
      .map((item) => item.subcategory)
      .filter((value): value is string => !!value?.trim()))
    for (const subcategory of subcategories) {
      counts.set(subcategory, (counts.get(subcategory) ?? 0) + 1)
    }
  }

  if (!counts.size) return []
  return [
    { key: 'ALL', label: 'ALL', count: categoryCount, imageUrl: null },
    ...Array.from(counts, ([subcategory, count]) => ({
      key: subcategory, label: subcategory.toUpperCase(), count,
      imageUrl: images.get(subcategory) ?? null,
    })),
  ]
})

const filteredGroups = computed(() => {
  const query = search.value.trim().toLocaleLowerCase('th-TH')

  function matches(item: PriceListDto): boolean {
    if (filter.value.category !== 'ALL' && item.category.toUpperCase() !== filter.value.category) return false
    if (filter.value.category !== 'ALL' && filter.value.subcategory && item.subcategory !== filter.value.subcategory) return false
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

const emptyMessage = computed(() => {
  if (!itemGroups.value.length) return 'ยังไม่มีรายการราคาที่เปิดใช้งาน'
  if (filter.value.category !== 'ALL' && !itemGroups.value.some((group) =>
    group.items.some((item) => item.category.toUpperCase() === filter.value.category))) {
    return 'ยังไม่มีรายการที่เปิดใช้งานในหมวดนี้'
  }
  return 'ไม่พบรายการที่ตรงกับการค้นหาหรือตัวกรอง'
})

function selectCategory(key: string) {
  if (!categoryTabs.value.some((tab) => tab.key === key)) return
  updateFilter({ category: key, subcategory: null })
}

function selectSubcategory(key: string) {
  if (!subcategoryTabs.value.some((tab) => tab.key === key)) return
  updateFilter({ subcategory: key === 'ALL' ? null : key })
}

function selectService(value: string | null) {
  updateFilter({ serviceType: value })
}

function openCreate() {
  const category = items.value.find((item) => item.category.toUpperCase() === filter.value.category)?.category
  void router.push({
    name: 'price-list-create',
    query: category ? { category } : {},
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

watch(() => [route.name, route.query.category] as const, ([name, category]) => {
  if (name !== 'price-list') return
  if (typeof category === 'string' && category.trim()) return
  void router.replace({ name: 'price-list', query: { ...route.query, category: 'CLOTHING' } })
}, { immediate: true })

onMounted(() => {
  void priceListStore.load()
})
</script>

<template>
  <ListPageLayout :embedded="props.embedded">
    <template #filters>
      <GenericTabs
        :tabs="categoryTabs"
        :active-key="filter.category"
        @select="selectCategory"
      />
      <section v-if="subcategoryTabs.length" class="border-b border-outline-variant/20 bg-surface py-3" aria-label="กรองตามหมวดหมู่ย่อย">
        <p class="mb-2 px-4 font-label text-[11px] font-bold text-on-surface-variant">หมวดหมู่ย่อย</p>
        <ScrollRegion axis="x" sizing="auto" class="w-full px-4">
          <div class="flex w-max gap-2.5 pb-1">
            <button
              v-for="tab in subcategoryTabs"
              :key="tab.key"
              type="button"
              class="flex w-[88px] shrink-0 flex-col items-center gap-1.5 rounded-xl border p-2 text-center transition-colors focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              :class="tab.key === (filter.subcategory ?? 'ALL') ? 'border-primary bg-primary text-on-primary' : 'border-outline-variant/30 bg-surface-container-low text-on-surface'"
              :aria-pressed="tab.key === (filter.subcategory ?? 'ALL')"
              :aria-label="`${tab.label} ${tab.count} รายการ`"
              @click="selectSubcategory(tab.key)"
            >
              <span v-if="tab.key === 'ALL'" class="flex h-12 w-12 items-center justify-center rounded-lg bg-surface text-primary">
                <span class="material-symbols-outlined text-[27px]" aria-hidden="true">apps</span>
              </span>
              <ImageOrIcon v-else :image-url="tab.imageUrl" icon="category" fit="contain" class="h-12 w-12 rounded-lg bg-surface" />
              <span class="w-full truncate font-label text-[10px] font-bold leading-3.5">{{ tab.label }}</span>
            </button>
          </div>
        </ScrollRegion>
      </section>
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
      :empty-text="emptyMessage"
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

      <template #loading>
        <div class="grid grid-cols-2 gap-3 p-4" aria-busy="true" aria-label="กำลังโหลดรายการราคา">
          <div v-for="n in 4" :key="n" class="overflow-hidden rounded-2xl bg-surface-container-low">
            <div class="aspect-[4/3] animate-pulse bg-surface-container" />
            <div class="m-3 h-5 animate-pulse rounded bg-surface-container" />
          </div>
        </div>
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
        <p class="px-6 py-4 font-body text-sm italic text-on-surface-variant">{{ emptyMessage }}</p>
      </template>

      <template #error>
        <PriceListServicePanel
          v-if="serviceFilterOpen"
          :service-type="filter.serviceType"
          @select="selectService"
        />
        <p class="px-6 py-4 font-body text-sm text-error">{{ listError }}</p>
      </template>

      <div class="grid grid-cols-2 gap-3 bg-surface p-4">
        <PriceListCard
          v-for="group in filteredGroups"
          :key="group.itemCode"
          :item-code="group.itemCode"
          :items="group.items"
          @open="openOptions"
        />
      </div>
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
