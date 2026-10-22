<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute, useRouter } from 'vue-router'
import ListPageLayout from '@/shared/layouts/ListPageLayout.vue'
import GenericTabs from '@/shared/components/GenericTabs.vue'
import { usePriceListStore } from '@/data/price-list/price-list.store'
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

function openCreate() {
  const category = items.value.find((item) => item.category.toUpperCase() === filter.value.category)?.category
  void router.push({
    name: 'price-list-create',
    query: category ? { category } : {},
  })
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
      <button
        type="button"
        class="-mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-primary transition-colors hover:bg-primary/10 active:bg-primary/20 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime"
        aria-label="Add price list item"
        @click="openCreate"
      >
        <span class="material-symbols-outlined text-[16px]" aria-hidden="true">new_label</span>
      </button>
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
