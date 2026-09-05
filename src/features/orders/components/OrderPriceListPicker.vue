<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { z } from 'zod'
import type { priceListListResponseSchema } from '@contracts/price-list/price-list-api.schema'
import { serviceTypeLabel, serviceTypePresentation } from '@/shared/utils/service-type-labels'
import BaseOverlay from '@/shared/layouts/BaseOverlay.vue'
import OrderPriceListItemRow from './OrderPriceListItemRow.vue'

type PriceListItem = z.infer<typeof priceListListResponseSchema>
type ServiceType = PriceListItem['serviceType']

defineOptions({ name: 'OrderPriceListPicker' })

const props = defineProps<{
  open: boolean
  items: PriceListItem[]
  loading: boolean
  error: string | null
  truncated: boolean
  serviceType: ServiceType
  orderLabel?: string
}>()

const emit = defineEmits<{
  close: []
  retry: []
  select: [item: PriceListItem]
}>()

const searchQuery = ref('')
const selectedCategory = ref<string | null>(null)

const categories = computed(() =>
  [...new Set(props.items.map((item) => item.category).filter(Boolean))].sort((left, right) =>
    left.localeCompare(right, 'th-TH'),
  ),
)

const filteredItems = computed(() => {
  const query = searchQuery.value.trim().toLocaleLowerCase('th-TH')

  return props.items.filter((item) => {
    if (selectedCategory.value && item.category !== selectedCategory.value) return false
    if (!query) return true

    return [
      item.itemCode,
      item.category,
      item.subcategory,
      item.itemType,
      item.variant,
      item.displayNameTh,
      item.displayNameEn,
      serviceTypeLabel(item.serviceType),
    ]
      .some((value) => String(value ?? '').toLocaleLowerCase('th-TH').includes(query))
  })
})

const showEmpty = computed(() => !props.loading && !props.error && filteredItems.value.length === 0)
const servicePresentation = computed(() => serviceTypePresentation[props.serviceType])

watch(
  [() => props.open, () => props.serviceType, () => props.orderLabel],
  ([open]) => {
    if (!open) return
    searchQuery.value = ''
    selectedCategory.value = null
  },
)

function clearSearch() {
  searchQuery.value = ''
}

function selectCategory(category: string | null) {
  selectedCategory.value = category
}
</script>

<template>
  <BaseOverlay :open="props.open" variant="full" aria-label="เลือกรายการสินค้าจากรายการราคา" @close="emit('close')">
    <div class="flex min-h-full flex-col bg-surface text-on-surface">
      <header class="sticky top-0 z-20 bg-primary text-on-primary shadow-md">
        <div class="flex items-start justify-between gap-3 px-4 pb-3 pr-14 pt-4">
          <div class="min-w-0">
            <p class="font-label text-[10px] font-bold uppercase tracking-[0.14em] text-mint">เพิ่มรายการสินค้า</p>
            <h1 class="mt-0.5 truncate font-headline text-lg font-bold leading-tight">เลือกรายการจากราคา</h1>
            <p class="mt-1 truncate font-body text-xs text-on-primary/80">
              {{ props.orderLabel || 'ออเดอร์นี้' }} · {{ servicePresentation.icon ? servicePresentation.label : props.serviceType }}
            </p>
          </div>
          <span class="mt-1 inline-flex shrink-0 items-center gap-1 rounded-full border border-white/15 bg-white/10 px-2.5 py-1 font-label text-[11px] font-bold">
            <span class="material-symbols-outlined text-[15px] text-mint" aria-hidden="true">{{ servicePresentation.icon }}</span>
            {{ props.items.length }} รายการ
          </span>
        </div>

        <div class="px-4 pb-3">
          <label class="relative block">
            <span class="sr-only">ค้นหารายการสินค้า</span>
            <span class="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-on-surface-variant/55" aria-hidden="true">search</span>
            <input
              v-model="searchQuery"
              type="search"
              autocomplete="off"
              placeholder="ค้นหาชื่อ รหัส หรือประเภทผ้า"
              class="w-full rounded-xl border-0 bg-white py-2.5 pl-10 pr-10 font-body text-sm font-medium text-on-surface shadow-inner outline-none placeholder:text-on-surface-variant/55 focus:ring-2 focus:ring-mint"
            >
            <button
              v-if="searchQuery"
              type="button"
              class="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-on-surface-variant/65 hover:bg-surface-container focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
              aria-label="ล้างคำค้นหา"
              @click="clearSearch"
            >
              <span class="material-symbols-outlined text-[18px]" aria-hidden="true">cancel</span>
            </button>
          </label>
        </div>

        <nav class="flex gap-1.5 overflow-x-auto border-t border-white/10 px-3 py-2.5 no-scrollbar" aria-label="กรองตามหมวดหมู่">
          <button
            type="button"
            class="shrink-0 rounded-full px-3 py-1.5 font-label text-xs font-semibold transition-colors"
            :class="selectedCategory === null ? 'bg-white text-primary shadow-sm' : 'bg-white/10 text-on-primary hover:bg-white/20'"
            :aria-pressed="selectedCategory === null"
            @click="selectCategory(null)"
          >ทั้งหมด</button>
          <button
            v-for="category in categories"
            :key="category"
            type="button"
            class="shrink-0 rounded-full px-3 py-1.5 font-label text-xs font-semibold transition-colors"
            :class="selectedCategory === category ? 'bg-white text-primary shadow-sm' : 'bg-white/10 text-on-primary hover:bg-white/20'"
            :aria-pressed="selectedCategory === category"
            @click="selectCategory(category)"
          >{{ category }}</button>
        </nav>
      </header>

      <div v-if="props.truncated && !props.loading && !props.error" class="flex items-start gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2.5 font-body text-xs leading-relaxed text-amber-900">
        <span class="material-symbols-outlined mt-0.5 text-[17px] text-amber-700" aria-hidden="true">info</span>
        <p>แสดงรายการได้ไม่ครบ ลองพิมพ์คำค้นหาให้เจาะจงเพื่อหารายการที่ต้องการ</p>
      </div>

      <div v-if="props.loading" class="space-y-1 p-4" aria-busy="true" aria-label="กำลังโหลดรายการราคา">
        <div v-for="index in 6" :key="index" class="flex gap-3 border-b border-outline-variant/10 py-3.5">
          <div class="h-11 w-11 shrink-0 animate-pulse rounded-2xl bg-surface-container" />
          <div class="flex-1 space-y-2"><div class="h-4 w-3/4 animate-pulse rounded bg-surface-container" /><div class="h-3 w-1/2 animate-pulse rounded bg-surface-container" /><div class="h-3 w-2/5 animate-pulse rounded bg-surface-container" /></div>
        </div>
      </div>

      <section v-else-if="props.error" class="px-6 py-16 text-center">
        <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-error-container text-error"><span class="material-symbols-outlined text-[30px]" aria-hidden="true">wifi_off</span></div>
        <h2 class="mt-4 font-headline text-base font-bold">เปิดรายการราคาไม่สำเร็จ</h2>
        <p class="mx-auto mt-2 max-w-xs font-body text-sm leading-relaxed text-on-surface-variant">{{ props.error }}</p>
        <button type="button" class="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 font-label text-sm font-bold text-on-primary shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" @click="emit('retry')"><span class="material-symbols-outlined text-[18px]" aria-hidden="true">refresh</span>ลองโหลดอีกครั้ง</button>
      </section>

      <section v-else-if="showEmpty" class="px-6 py-16 text-center">
        <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-container text-on-surface-variant"><span class="material-symbols-outlined text-[30px]" aria-hidden="true">search_off</span></div>
        <h2 class="mt-4 font-headline text-base font-bold">ไม่พบรายการที่ค้นหา</h2>
        <p class="mx-auto mt-2 max-w-xs font-body text-sm leading-relaxed text-on-surface-variant">ลองค้นหาด้วยชื่อสินค้า รหัส หรือเปลี่ยนหมวดหมู่</p>
      </section>

      <div v-else class="divide-y divide-outline-variant/15">
        <OrderPriceListItemRow v-for="item in filteredItems" :key="item.id" :item="item" @select="emit('select', $event)" />
      </div>
    </div>
  </BaseOverlay>
</template>

<style>
dialog[aria-label="เลือกรายการสินค้าจากรายการราคา"] > .base-overlay-panel > button[aria-label="Close"] {
  color: #ffffff;
}

dialog[aria-label="เลือกรายการสินค้าจากรายการราคา"] > .base-overlay-panel > button[aria-label="Close"]:hover,
dialog[aria-label="เลือกรายการสินค้าจากรายการราคา"] > .base-overlay-panel > button[aria-label="Close"]:focus-visible {
  background-color: rgb(255 255 255 / 0.12);
}
</style>
