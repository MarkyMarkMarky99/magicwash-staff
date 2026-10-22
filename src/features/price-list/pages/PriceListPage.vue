<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute, useRouter } from 'vue-router'
import ListPageLayout from '@/shared/layouts/ListPageLayout.vue'
import GenericTabs from '@/shared/components/GenericTabs.vue'
import StickerFab from '@/shared/components/StickerFab.vue'
import { usePriceListStore } from '@/data/price-list/price-list.store'
import { useItemsStore } from '@/data/items/items.store'
import PriceListServiceSwitch from '../components/PriceListServiceSwitch.vue'
import PriceListSubcategoryCard from '../components/PriceListSubcategoryCard.vue'
import { usePriceListFilterRoute } from '../composables/usePriceListFilterRoute'
import { comparePriceListCategories } from '../utils/price-list-display'
import {
  buildPriceListCards,
  countPriceListRows,
  isServiceType,
  retailPriceRows,
  serviceLabel,
} from '../utils/price-list-table'

defineOptions({ name: 'PriceListPage' })

const props = defineProps<{
  embedded?: boolean
}>()

const router = useRouter()
const route = useRoute()
const priceListStore = usePriceListStore()
const { items, loading, error, loaded, truncated } = storeToRefs(priceListStore)
const itemsStore = useItemsStore()
const criteriaByItemCode = computed(() => new Map(
  itemsStore.items.flatMap((item) => item.criteria?.trim() ? [[item.itemCode, item.criteria.trim()] as const] : []),
))
const listLoading = computed(() => loading.value && !loaded.value)
const listError = computed(() => {
  if (loaded.value) return null
  if (truncated.value) return 'The price list has more than 1,000 rows, so it could not be fully loaded'
  return error.value
})

const { filter, updateFilter } = usePriceListFilterRoute()
const serviceType = computed(() => (isServiceType(filter.value.serviceType) ? filter.value.serviceType : null))

const retailRows = computed(() => retailPriceRows(items.value))

const categoryTabs = computed(() => {
  const categories = new Set(items.value.map((item) => item.category.toUpperCase()))
  const counts = (category: string | null) => countPriceListRows(buildPriceListCards(
    retailRows.value.filter((item) => category === null || item.category.toUpperCase() === category),
    null,
  ))
  return [
    { key: 'ALL', label: 'ALL', count: counts(null) },
    ...[...categories].sort(comparePriceListCategories).map((category) => ({ key: category, label: category, count: counts(category) })),
  ]
})

const cards = computed(() => buildPriceListCards(
  retailRows.value.filter((item) => filter.value.category === 'ALL' || item.category.toUpperCase() === filter.value.category),
  serviceType.value,
  criteriaByItemCode.value,
))
const rowCount = computed(() => countPriceListRows(cards.value))
const subtitle = computed(() => `${rowCount.value} ${rowCount.value === 1 ? 'item' : 'items'} · ${serviceType.value ? serviceLabel(serviceType.value) : 'All services'}`)
const emptyMessage = computed(() => (retailRows.value.length ? 'No items in this category' : 'No active prices yet'))

function selectCategory(key: string) {
  if (!categoryTabs.value.some((tab) => tab.key === key)) return
  updateFilter({ category: key, subcategory: null })
}

function selectService(value: string | null) {
  updateFilter({ serviceType: value })
}

function openPriceAgent() {
  void router.push({ name: 'agent-chat', params: { agentId: 'price-check' } })
}

function openEdit(id: string) {
  void router.push({ name: 'price-list-edit', params: { id } })
}

watch(() => [route.name, route.query.category] as const, ([name, category]) => {
  if (name !== 'price-list') return
  if (typeof category === 'string' && category.trim()) return
  void router.replace({ name: 'price-list', query: { ...route.query, category: 'CLOTHING' } })
}, { immediate: true })

onMounted(() => {
  void priceListStore.load()
  void itemsStore.load()
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
    </template>

    <div class="flex items-start gap-3 px-4 pb-2 pt-4">
      <div class="min-w-0 flex-1 border-l-4 border-lime pl-2">
        <h2 class="font-headline text-xl font-bold leading-tight text-primary">Price list{{ filter.category === 'ALL' ? '' : ` · ${filter.category}` }}</h2>
        <span class="mt-0.5 block font-label text-[10px] font-extrabold uppercase tracking-[0.08em] text-on-surface-variant">{{ subtitle }}</span>
      </div>
      <StickerFab class="!h-12 !w-12 !rounded-[17px_20px_17px_19px]" label="Ask AI" aria-label="Ask the price agent" @click="openPriceAgent">
        <span class="material-symbols-outlined text-[22px]" aria-hidden="true">smart_toy</span>
      </StickerFab>
    </div>

    <div v-if="listLoading" class="grid gap-7 px-4 pb-3 pt-6" aria-busy="true" aria-label="Loading price list">
      <div v-for="n in 2" :key="n" class="h-40 animate-pulse rounded-[11px_15px_12px_14px] bg-surface-container" />
    </div>
    <p v-else-if="listError" role="alert" class="px-6 py-4 font-body text-sm text-error">{{ listError }}</p>
    <p v-else-if="!cards.length" class="px-6 py-10 text-center font-body text-sm italic text-on-surface-variant">{{ emptyMessage }}</p>
    <div v-else class="grid gap-7 px-4 pb-3 pt-6">
      <PriceListSubcategoryCard
        v-for="card in cards"
        :key="card.key"
        :card="card"
        :show-service-labels="serviceType === null"
        @edit="openEdit"
      />
    </div>
    <div class="h-12" aria-hidden="true" />

    <PriceListServiceSwitch :service-type="serviceType" @select="selectService" />
  </ListPageLayout>
</template>
