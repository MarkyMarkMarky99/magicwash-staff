<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { z } from 'zod'
import type { priceListListResponseSchema } from '@contracts/price-list/price-list-api.schema'
import PickerOverlay from '@/shared/layouts/PickerOverlay.vue'
import DetailOverlay from '@/shared/layouts/DetailOverlay.vue'
import ScrollRegion from '@/shared/components/ScrollRegion.vue'
import ImageOrIcon from '@/shared/components/ImageOrIcon.vue'
import ImageContentCard from '@/shared/components/ImageContentCard.vue'
import { serviceTypeLabel } from '@/shared/utils/service-type-labels'
import { groupItemTypes, groupVariants } from '../utils/price-list-picker-groups'

type PriceListItem = z.infer<typeof priceListListResponseSchema>
type ItemTypeGroup = ReturnType<typeof groupItemTypes<PriceListItem>>[number]

const props = defineProps<{
  open: boolean
  detail: string
  items: PriceListItem[]
  loading: boolean
  error: string | null
  truncated: boolean
}>()

const emit = defineEmits<{
  close: []
  retry: []
  select: [item: PriceListItem]
}>()

const search = ref('')
const category = ref<string | null>(null)
const selectedTypeKey = ref<string | null>(null)
const selectedVariantKey = ref('')
const sheetOpen = ref(false)
const step = ref<'variant' | 'price'>('variant')
const stepTransition = ref('picker-step-forward')

const categories = computed(() =>
  [...new Set(props.items.map((item) => item.category))].sort((a, b) => a.localeCompare(b, 'th-TH')),
)

const filteredItems = computed(() => {
  const query = search.value.trim().toLocaleLowerCase('th-TH')
  return props.items.filter((item) => {
    if (category.value !== null && item.category !== category.value) return false
    if (!query) return true
    return [item.itemCode, item.category, item.subcategory, item.itemType, item.variant,
      item.displayNameTh, item.displayNameEn, serviceTypeLabel(item.serviceType)]
      .some((value) => String(value ?? '').toLocaleLowerCase('th-TH').includes(query))
  })
})

const typeGroups = computed(() => groupItemTypes(filteredItems.value))

const categoryGroups = computed(() => {
  const groups = new Map<string, ItemTypeGroup[]>()
  for (const group of typeGroups.value) {
    const existing = groups.get(group.category)
    if (existing) existing.push(group)
    else groups.set(group.category, [group])
  }
  return [...groups].map(([name, groups]) => ({ name, groups }))
})

const selectedType = computed(() => typeGroups.value.find((group) => group.key === selectedTypeKey.value) ?? null)
const variants = computed(() => groupVariants(selectedType.value?.items ?? []))
const priceOptions = computed(() =>
  selectedType.value?.items.filter((item) => (item.variant ?? '') === selectedVariantKey.value) ?? [],
)

watch(() => props.open, (open) => {
  if (open) {
    search.value = ''
    category.value = null
  } else closeSheet()
})

function imageFor(items: PriceListItem[]): string | null {
  return items.find((item) => item.imageUrl)?.imageUrl ?? null
}

function variantCount(items: PriceListItem[]): number {
  return groupVariants(items).length
}

function openType(group: ItemTypeGroup) {
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

function selectOption(item: PriceListItem) {
  closeSheet()
  emit('select', item)
}

function formatPrice(price: number): string {
  return `฿${new Intl.NumberFormat('th-TH').format(price)}`
}
</script>

<template>
  <PickerOverlay
    :open="open" size="full" :draggable="false" panel-class="app-column price-list-picker-full"
    ariaLabel="เลือกรายการราคา" @close="emit('close')"
  >
    <template #header>
      <header class="flex-none bg-primary px-4 pb-4 pt-[calc(1.75rem+env(safe-area-inset-top))] pr-16 text-on-primary">
        <p class="font-label text-[11px] font-bold text-mint">รายการราคา</p>
        <h1 class="mt-1 font-headline text-xl font-bold">เลือกประเภทสินค้า</h1>
        <p class="mt-1 truncate font-body text-xs text-on-primary/80">{{ detail }}</p>
        <label class="relative mt-4 block">
          <span class="sr-only">ค้นหารายการสินค้า</span>
          <span class="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-on-surface-variant" aria-hidden="true">search</span>
          <input v-model="search" type="search" autocomplete="off" placeholder="ค้นหาชื่อ รหัส รุ่น หรือบริการ"
            class="w-full rounded-xl bg-white py-2.5 pl-10 pr-3 font-body text-sm text-on-surface outline-none focus:ring-2 focus:ring-mint">
        </label>
      </header>

      <ScrollRegion axis="x" sizing="auto" class="flex-none border-b border-outline-variant/20 bg-surface px-3 py-2">
        <div class="flex gap-2">
          <button type="button" class="shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold"
            :class="category === null ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface'"
            :aria-pressed="category === null" @click="category = null">ทั้งหมด</button>
          <button v-for="name in categories" :key="name" type="button"
            class="shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold"
            :class="category === name ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface'"
            :aria-pressed="category === name" @click="category = name">{{ name }}</button>
        </div>
      </ScrollRegion>

      <p v-if="truncated && !loading && !error" class="flex-none bg-amber-50 px-4 py-2 text-xs text-amber-900">รายการอาจไม่ครบ กรุณาค้นหาเพิ่มเติม</p>
    </template>
        <div v-if="loading" class="grid grid-cols-2 gap-3 p-4" aria-busy="true" aria-label="กำลังโหลดรายการราคา">
          <div v-for="n in 6" :key="n" class="overflow-hidden rounded-2xl bg-surface-container-low">
            <div class="aspect-[4/3] animate-pulse bg-surface-container" />
            <div class="m-3 h-5 animate-pulse rounded bg-surface-container" />
          </div>
        </div>
        <div v-else-if="error" class="px-6 py-16 text-center">
          <p class="text-sm text-error">{{ error }}</p>
          <button type="button" class="mt-4 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-on-primary" @click="emit('retry')">ลองโหลดอีกครั้ง</button>
        </div>
        <div v-else-if="typeGroups.length === 0" class="px-6 py-16 text-center text-sm text-on-surface-variant">ไม่พบประเภทสินค้าที่ตรงกับการค้นหา</div>
        <div v-else class="space-y-5 p-4">
          <section v-for="section in categoryGroups" :key="section.name">
            <h2 class="mb-3 font-headline text-sm font-bold text-on-surface">{{ section.name }}</h2>
            <div class="grid grid-cols-2 gap-3">
              <button v-for="group in section.groups" :key="group.key" type="button"
                class="min-w-0 rounded-2xl text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                :aria-label="`เลือก ${group.itemType} ${group.subcategory}`" @click="openType(group)">
                <ImageContentCard :image-url="imageFor(group.items)" :title="group.itemType" icon="checkroom" class="h-full">
                  <span class="block truncate text-[11px] text-on-surface-variant">{{ group.subcategory }}</span>
                  <span class="block truncate text-[11px] text-on-surface-variant">เช่น {{ group.items[0]?.displayNameTh }}</span>
                  <template #footer>
                    <span class="block text-xs font-semibold text-primary">{{ variantCount(group.items) }} รุ่น · {{ group.items.length }} ราคา</span>
                  </template>
                </ImageContentCard>
              </button>
            </div>
          </section>
        </div>
  </PickerOverlay>

  <DetailOverlay :open="open && sheetOpen" :ariaLabel="selectedType?.itemType ?? 'เลือกตัวเลือกราคา'" @close="closeSheet">
    <template #header>
      <header class="flex items-center gap-3 border-b border-outline-variant/20 px-4 pb-2 pr-14 pt-0.5">
        <button v-if="step === 'price'" type="button" class="rounded-full p-2 text-primary" aria-label="กลับไปเลือกรุ่น" @click="backToVariants">
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
            <p class="font-label text-xs font-bold text-on-surface-variant">เลือกรุ่น / ขนาด</p>
            <button v-for="variant in variants" :key="variant.key" type="button"
              class="flex w-full items-center gap-3 rounded-2xl border border-outline-variant/30 p-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
              @click="chooseVariant(variant.key)">
              <ImageOrIcon :image-url="imageFor(variant.items)" icon="checkroom" fit="contain"
                class="h-16 w-16 rounded-xl bg-surface-container-low" />
              <span class="min-w-0 flex-1">
                <strong class="block truncate text-sm">{{ variant.name }}</strong>
                <span class="block truncate text-xs text-on-surface-variant">{{ variant.items[0]?.displayNameTh }}</span>
              </span>
              <span class="shrink-0 text-xs font-semibold text-primary">{{ variant.items.length }} ราคา</span>
            </button>
          </div>
          <div v-else key="price" class="space-y-3 p-4">
            <p class="font-label text-xs font-bold text-on-surface-variant">เลือกบริการและราคา · {{ selectedVariantKey || 'ทั่วไป' }}</p>
            <button v-for="item in priceOptions" :key="item.id" type="button"
              class="w-full rounded-2xl border border-outline-variant/30 bg-surface p-4 text-left shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
              :aria-label="`เลือก ${item.displayNameTh} ${serviceTypeLabel(item.serviceType)} ราคา ${formatPrice(item.price)}`"
              @click="selectOption(item)">
              <span class="flex items-start justify-between gap-3">
                <span class="min-w-0">
                  <strong class="block text-sm">{{ item.displayNameTh }}</strong>
                  <span class="mt-1 block text-xs text-on-surface-variant">{{ serviceTypeLabel(item.serviceType) }} · {{ item.itemCode }}<template v-if="item.unit"> · ต่อ {{ item.unit }}</template></span>
                  <span class="mt-1 block text-[11px] text-on-surface-variant">มีผล {{ item.effectiveFrom }}<template v-if="item.creditEligible"> · ใช้เครดิตได้</template></span>
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
</style>
