<script setup lang="ts" generic="T extends ItemDto">
import { computed, ref, watch } from 'vue'
import type { z } from 'zod'
import type { priceListListResponseSchema } from '@contracts/price-list/price-list-api.schema'
import type { ItemDto } from '@/data/items/items.service'
import PickerOverlay from '@/shared/layouts/PickerOverlay.vue'
import DetailOverlay from '@/shared/layouts/DetailOverlay.vue'
import ScrollRegion from '@/shared/components/ScrollRegion.vue'
import ImageOrIcon from '@/shared/components/ImageOrIcon.vue'
import { serviceTypeLabel, serviceTypeLabelEn } from '@/shared/utils/service-type-labels'
import { groupItemTypes, groupVariants } from '../utils/price-list-picker-groups'
import { comparePriceListCategories, defaultItemCategory, defaultItemSubcategory } from '../utils/price-list-display'

type PriceListItem = z.infer<typeof priceListListResponseSchema>
type ItemTypeGroup = ReturnType<typeof groupItemTypes<T>>[number]

const props = defineProps<{
  open: boolean
  detail: string
  items: T[]
  selectionMode?: 'item' | 'price'
  loading: boolean
  error: string | null
  truncated: boolean
}>()

const emit = defineEmits<{
  close: []
  create: [category: string | null, subcategory: string | null]
  retry: []
  select: [item: T]
}>()

const search = ref('')
const category = ref<string | null>(null)
const subcategory = ref<string | null>(null)
const selectedTypeKey = ref<string | null>(null)
const selectedVariantKey = ref('')
const sheetOpen = ref(false)
const step = ref<'variant' | 'price'>('variant')
const stepTransition = ref('picker-step-forward')

const categories = computed(() => [...new Set(props.items.map((item) => item.category))]
  .sort(comparePriceListCategories))

const subcategories = computed(() => [...new Set(props.items
  .filter((item) => category.value === null || item.category === category.value)
  .map((item) => item.subcategory))].sort((a, b) => a.localeCompare(b, 'th-TH')))

const filteredItems = computed(() => {
  const query = search.value.trim().toLocaleLowerCase('th-TH')
  return props.items.filter((item) => {
    if (category.value !== null && item.category !== category.value) return false
    if (subcategory.value !== null && item.subcategory !== subcategory.value) return false
    if (!query) return true
    return [item.itemCode, item.category, item.subcategory, item.itemType, item.variant,
      item.displayNameTh, item.displayNameEn,
      ...('serviceType' in item ? [serviceTypeLabel(String(item.serviceType)), serviceTypeLabelEn(String(item.serviceType))] : [])]
      .some((value) => String(value ?? '').toLocaleLowerCase('th-TH').includes(query))
  })
})

const typeGroups = computed<ItemTypeGroup[]>(() => props.selectionMode === 'item'
  ? filteredItems.value.map((item) => ({
    key: item.itemCode, category: item.category, subcategory: item.subcategory,
    itemType: item.itemType, items: [item],
  }))
  : groupItemTypes(filteredItems.value))

const selectedType = computed(() => typeGroups.value.find((group) => group.key === selectedTypeKey.value) ?? null)
const variants = computed(() => groupVariants(selectedType.value?.items ?? []))
const priceOptions = computed(() =>
  selectedType.value?.items.filter((item): item is T & PriceListItem =>
    'price' in item && 'serviceType' in item && (item.variant ?? '') === selectedVariantKey.value) ?? [],
)

watch(() => props.open, (open) => {
  if (open) {
    search.value = ''
    category.value = props.selectionMode === 'item' ? defaultItemCategory : null
    subcategory.value = props.selectionMode === 'item' ? defaultItemSubcategory : null
  } else closeSheet()
})

function imageFor(items: T[]): string | null {
  return items.find((item) => item.imageUrl)?.imageUrl ?? null
}

function categoryIcon(name: string | null): string {
  if (name === null) return 'apps'
  switch (name.toUpperCase()) {
    case 'CLOTHING': return 'checkroom'
    case 'BEDDING': return 'bed'
    case 'HOUSEHOLD': return 'chair'
    case 'OTHERS': return 'category'
    default: return 'inventory_2'
  }
}

function selectCategory(name: string | null) {
  category.value = name
  subcategory.value = null
}

function openType(group: ItemTypeGroup) {
  if (props.selectionMode === 'item') {
    emit('select', group.items[0]!)
    return
  }
  selectedTypeKey.value = group.key
  selectedVariantKey.value = ''
  step.value = 'variant'
  sheetOpen.value = true
}

function chooseVariant(key: string) {
  selectedVariantKey.value = key
  stepTransition.value = 'picker-step-forward'
  step.value = 'price'
}

function backToVariants() {
  stepTransition.value = 'picker-step-back'
  step.value = 'variant'
}

function closeSheet() {
  sheetOpen.value = false
  selectedTypeKey.value = null
  step.value = 'variant'
}

function selectOption(item: T) {
  closeSheet()
  emit('select', item)
}

function formatPrice(price: number): string {
  return `฿${new Intl.NumberFormat('en-US').format(price)}`
}
</script>

<template>
  <PickerOverlay
    :open="open" size="full" :draggable="false"
    :panel-class="`app-column price-list-picker-full${selectionMode === 'item' ? ' price-list-picker-static' : ''}`"
    ariaLabel="Select a price list item" @close="emit('close')"
  >
    <template #header>
      <header class="relative flex-none overflow-hidden bg-primary text-on-primary">
        <div v-if="selectionMode === 'item'" class="pointer-events-none absolute -right-[138px] -top-[112px] h-[270px] w-[270px] rounded-full border-[34px] border-mint/[0.17]" aria-hidden="true" />
        <div class="relative px-4" :class="selectionMode === 'item' ? 'pb-3 pt-[calc(1rem+env(safe-area-inset-top))]' : 'pb-4 pt-[calc(1.75rem+env(safe-area-inset-top))]'">
          <p v-if="selectionMode !== 'item'" class="font-label text-[11px] font-bold text-mint">PRICE LIST</p>
          <h1 class="pr-12 font-headline text-xl font-bold" :class="selectionMode === 'item' ? 'flex h-10 items-center' : 'mt-1'">Select an item</h1>
          <p v-if="selectionMode !== 'item'" class="mt-1 truncate font-body text-xs text-on-primary/80">{{ detail }}</p>
          <label class="relative block" :class="selectionMode === 'item' ? 'mt-2' : 'mt-4'">
            <span class="sr-only">Search items</span>
            <span class="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-on-surface-variant" aria-hidden="true">search</span>
            <input v-model="search" type="search" autocomplete="off" :placeholder="selectionMode === 'item' ? 'Search name, code, or category' : 'Search name, code, variant, or service'"
              class="w-full rounded-xl bg-white pl-10 pr-3 font-body text-sm text-on-surface outline-none focus:ring-2 focus:ring-mint"
              :class="selectionMode === 'item' ? 'py-2' : 'py-2.5'">
          </label>
        </div>
        <div v-if="selectionMode === 'item'" class="relative h-4 rounded-t-2xl bg-surface" aria-hidden="true" />
      </header>

      <p v-if="truncated && !loading && !error" class="flex-none bg-amber-50 px-4 py-2 text-xs text-amber-900">This list may be incomplete. Try a more specific search.</p>
    </template>
        <section v-if="!loading && !error && categories.length" class="pt-5">
          <h2 class="px-4 font-headline text-lg font-bold text-on-surface">Categories</h2>
          <ScrollRegion axis="x" sizing="auto" class="mt-3 px-4">
            <div class="flex w-max gap-3 pb-2 pr-4">
              <button v-for="name in [null, ...categories]" :key="name ?? 'all'" type="button"
                class="flex w-[76px] shrink-0 flex-col items-center gap-2 text-center focus-visible:rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                :aria-pressed="category === name" @click="selectCategory(name)">
                <span class="flex h-[72px] w-[72px] items-center justify-center rounded-full border-2 transition-colors"
                  :class="category === name ? 'border-primary bg-primary text-on-primary' : 'border-transparent bg-surface-container-low text-primary'">
                  <span class="material-symbols-outlined text-[28px]" aria-hidden="true">{{ categoryIcon(name) }}</span>
                </span>
                <span class="w-full truncate font-label text-xs font-semibold text-on-surface">{{ name ?? 'All' }}</span>
              </button>
            </div>
          </ScrollRegion>
        </section>

        <section v-if="!loading && !error && subcategories.length" class="pt-5">
          <h2 class="px-4 font-headline text-lg font-bold text-on-surface">Subcategories</h2>
          <ScrollRegion axis="x" sizing="auto" class="mt-3 px-4">
            <div class="flex w-max gap-2 pb-2 pr-4">
              <button v-for="name in [null, ...subcategories]" :key="name ?? 'all'" type="button"
                class="shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                :class="subcategory === name ? 'bg-primary text-on-primary' : 'bg-surface-container-low text-on-surface'"
                :aria-pressed="subcategory === name" @click="subcategory = name">{{ name ?? 'All' }}</button>
            </div>
          </ScrollRegion>
        </section>

        <div v-if="selectionMode === 'item' || (!loading && !error && typeGroups.length)" class="flex items-center justify-between gap-3 px-4 pt-5">
          <h2 v-if="!loading && !error && typeGroups.length" class="font-headline text-lg font-bold text-on-surface">Items</h2>
          <button v-if="selectionMode === 'item'" type="button" :disabled="!category || !subcategory" class="ml-auto font-label text-xs font-bold tracking-wide text-primary focus-visible:rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-40" @click="emit('create', category, subcategory)">NEW ITEM</button>
        </div>
        <div v-if="loading" class="grid grid-cols-2 gap-3 p-4" aria-busy="true" aria-label="Loading price list items">
          <div v-for="n in 6" :key="n" class="overflow-hidden rounded-2xl bg-surface-container-low">
            <div class="aspect-4/3 animate-pulse bg-surface-container" />
            <div class="m-3 h-5 animate-pulse rounded bg-surface-container" />
          </div>
        </div>
        <div v-else-if="error" class="px-6 py-16 text-center">
          <p class="text-sm text-error">Unable to load items.</p>
          <button type="button" class="mt-4 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-on-primary" @click="emit('retry')">Try again</button>
        </div>
        <div v-else-if="typeGroups.length === 0" class="px-6 py-16 text-center text-sm text-on-surface-variant">No matching items found.</div>
        <div v-else class="grid grid-cols-2 gap-x-3 gap-y-5 p-4 pt-3">
          <button v-for="group in typeGroups" :key="group.key" type="button"
            class="min-w-0 rounded-xl text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            :aria-label="`Select ${group.itemType} ${group.items[0]?.displayNameTh}${selectionMode === 'item' ? ` ${group.items[0]?.itemCode}` : ''} to add an item`" @click="openType(group)">
            <span class="relative block aspect-square overflow-hidden rounded-xl bg-surface-container-low">
              <ImageOrIcon :image-url="imageFor(group.items)" icon="checkroom" fit="contain"
                class="h-full w-full rounded-none border-0 bg-surface-container-low" />
              <span v-if="selectionMode === 'item'" class="absolute left-2 top-2 rounded-md bg-white/90 px-1.5 py-0.5 font-label text-[10px] font-semibold text-primary">{{ group.items[0]?.itemCode }}</span>
            </span>
            <span class="mt-2 flex min-w-0 items-center justify-between gap-1 pr-2">
              <strong class="min-w-0 truncate font-headline text-sm font-semibold text-on-surface">{{ group.itemType }}</strong>
              <span class="material-symbols-outlined shrink-0 text-[14px] text-primary" aria-hidden="true">add_shopping_cart</span>
            </span>
            <span class="mt-0.5 block truncate text-xs text-on-surface-variant">{{ group.items[0]?.displayNameTh }}</span>
          </button>
        </div>
  </PickerOverlay>

  <DetailOverlay v-if="selectionMode !== 'item'" :open="open && sheetOpen" :ariaLabel="selectedType?.itemType ?? 'Select a price option'" @close="closeSheet">
    <template #header>
      <header class="flex items-center gap-3 border-b border-outline-variant/20 px-4 pb-2 pr-14 pt-0.5">
        <button v-if="step === 'price'" type="button" class="rounded-full p-2 text-primary" aria-label="Back to variants" @click="backToVariants">
          <span class="material-symbols-outlined" aria-hidden="true">arrow_back</span>
        </button>
        <div class="min-w-0 flex-1">
          <p class="truncate text-xs text-on-surface-variant">{{ selectedType?.category }} · {{ selectedType?.subcategory }}</p>
          <h2 class="truncate font-headline text-lg font-bold">{{ selectedType?.itemType }}</h2>
        </div>
      </header>
    </template>
    <Transition :name="stepTransition" mode="out-in">
          <div v-if="step === 'variant'" key="variant" class="space-y-3 p-4">
            <p class="font-label text-xs font-bold text-on-surface-variant">Select a variant or size</p>
            <button v-for="variant in variants" :key="variant.key" type="button"
              class="flex w-full items-center gap-3 rounded-2xl border border-outline-variant/30 p-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
              @click="chooseVariant(variant.key)">
              <ImageOrIcon :image-url="imageFor(variant.items)" icon="checkroom" fit="contain"
                class="h-16 w-16 rounded-xl bg-surface-container-low" />
              <span class="min-w-0 flex-1">
                <strong class="block truncate text-sm">{{ variant.name }}</strong>
                <span class="block truncate text-xs text-on-surface-variant">{{ variant.items[0]?.displayNameTh }}</span>
              </span>
              <span class="shrink-0 text-xs font-semibold text-primary">{{ variant.items.length }} {{ variant.items.length === 1 ? 'price' : 'prices' }}</span>
            </button>
          </div>
          <div v-else key="price" class="space-y-3 p-4">
            <p class="font-label text-xs font-bold text-on-surface-variant">Select a service and price · {{ selectedVariantKey || 'General' }}</p>
            <button v-for="item in priceOptions" :key="item.id" type="button"
              class="w-full rounded-2xl border border-outline-variant/30 bg-surface p-4 text-left shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
              :aria-label="`Select ${item.displayNameTh} ${serviceTypeLabelEn(item.serviceType)} for ${formatPrice(item.price)}`"
              @click="selectOption(item)">
              <span class="flex items-start justify-between gap-3">
                <span class="min-w-0">
                  <strong class="block text-sm">{{ item.displayNameTh }}</strong>
                  <span class="mt-1 block text-xs text-on-surface-variant">{{ serviceTypeLabelEn(item.serviceType) }} · {{ item.itemCode }}<template v-if="item.unit"> · per {{ item.unit }}</template></span>
                  <span class="mt-1 block text-[11px] text-on-surface-variant">Effective {{ item.effectiveFrom }}<template v-if="item.creditEligible"> · Credit eligible</template></span>
                </span>
                <strong class="shrink-0 font-headline text-lg text-primary">{{ formatPrice(item.price) }}</strong>
              </span>
            </button>
          </div>
    </Transition>
  </DetailOverlay>
</template>

<style scoped>
.picker-step-forward-enter-active, .picker-step-forward-leave-active,
.picker-step-back-enter-active, .picker-step-back-leave-active { transition: transform 220ms ease, opacity 220ms ease; }
.picker-step-forward-enter-from, .picker-step-back-leave-to { transform: translateX(24px); opacity: 0; }
.picker-step-forward-leave-to, .picker-step-back-enter-from { transform: translateX(-24px); opacity: 0; }
@media (prefers-reduced-motion: reduce) {
  .picker-step-forward-enter-active, .picker-step-forward-leave-active,
  .picker-step-back-enter-active, .picker-step-back-leave-active { transition: none; }
}
</style>

<style>
.price-list-picker-full > button[aria-label="Close"] {
  top: calc(1rem + env(safe-area-inset-top));
}

.price-list-picker-static.base-overlay-frame-bottom-enter-active,
.price-list-picker-static.base-overlay-frame-bottom-leave-active {
  transition: opacity 180ms ease;
}

.price-list-picker-static.base-overlay-frame-bottom-enter-from,
.price-list-picker-static.base-overlay-frame-bottom-leave-to {
  transform: none !important;
  opacity: 0;
}
</style>
