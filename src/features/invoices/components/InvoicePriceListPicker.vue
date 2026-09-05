<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import BaseOverlay from '@/shared/layouts/BaseOverlay.vue'
import type { InvoicePriceListItemDto } from '../services/invoice-price-list.service'
import InvoicePriceListItemRow from './InvoicePriceListItemRow.vue'
import {
  PRICE_LIST_RENDER_CAP,
  capGroupedItems,
  filterPriceListItems,
  groupPriceListByCategory,
  iconForCategory,
  uniqueCategories,
} from '../utils/invoice-price-list.utils'

defineOptions({ name: 'InvoicePriceListPicker' })

const props = defineProps<{
  open: boolean
  invoiceNumber: string
  lineItemCount: number
  items: InvoicePriceListItemDto[]
  loading: boolean
  error: string | null
  truncated: boolean
}>()

const emit = defineEmits<{
  close: []
  retry: []
  select: [item: InvoicePriceListItemDto]
}>()

const searchQuery = ref('')
const selectedCategory = ref<string | null>(null)
const headerRef = ref<HTMLElement | null>(null)
const headerHeight = ref(0)
let headerObserver: ResizeObserver | null = null

const categories = computed(() => uniqueCategories(props.items))

const filteredItems = computed(() =>
  filterPriceListItems(props.items, {
    query: searchQuery.value,
    category: selectedCategory.value,
  }),
)

const rendered = computed(() =>
  capGroupedItems(groupPriceListByCategory(filteredItems.value), PRICE_LIST_RENDER_CAP),
)

const showLimitBanner = computed(() => props.truncated || rendered.value.truncated)

const showEmpty = computed(() =>
  !props.loading && !props.error && filteredItems.value.length === 0,
)

watch(
  () => props.open,
  (open) => {
    if (!open) return
    searchQuery.value = ''
    selectedCategory.value = null
  },
)

watch(headerRef, (el) => {
  headerObserver?.disconnect()
  headerObserver = null
  if (!el || typeof ResizeObserver === 'undefined') {
    headerHeight.value = el?.offsetHeight ?? 0
    return
  }
  headerObserver = new ResizeObserver(() => {
    headerHeight.value = el.offsetHeight
  })
  headerObserver.observe(el)
  headerHeight.value = el.offsetHeight
})

onBeforeUnmount(() => {
  headerObserver?.disconnect()
  headerObserver = null
})

function clearSearch() {
  searchQuery.value = ''
}

function selectCategory(category: string | null) {
  selectedCategory.value = category
}
</script>

<template>
  <BaseOverlay
    :open="open"
    variant="full"
    aria-label="เลือกจากรายการราคา"
    @close="emit('close')"
  >
    <div class="flex min-h-full flex-col bg-surface text-on-surface">
      <div ref="headerRef" class="sticky top-0 z-20 bg-primary text-on-primary shadow-md">
        <div class="flex items-center justify-between gap-2 px-4 pb-2 pr-14 pt-3">
          <div class="min-w-0">
            <h1 class="truncate font-headline text-base font-bold leading-tight">
              เลือกจากรายการราคา
            </h1>
            <p class="truncate font-body text-[11px] font-medium text-on-primary-container">
              เพิ่มสินค้าลงใบแจ้งหนี้ #{{ invoiceNumber || '—' }}
            </p>
          </div>
          <div class="flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/15 px-2.5 py-1">
            <span class="material-symbols-outlined text-[16px] text-on-primary-container" aria-hidden="true">receipt_long</span>
            <span class="font-label text-xs font-semibold">{{ lineItemCount }} รายการ</span>
          </div>
        </div>

        <div class="px-4 pb-2.5 pt-1">
          <div class="relative flex items-center">
            <span class="material-symbols-outlined pointer-events-none absolute left-3 text-[20px] text-on-surface-variant/50" aria-hidden="true">search</span>
            <input
              v-model="searchQuery"
              type="text"
              placeholder="ค้นหารหัส ชื่อ หรือหมวดหมู่..."
              autocomplete="off"
              class="w-full rounded-xl border-0 bg-white py-2 pl-9 pr-9 font-body text-sm font-medium text-on-surface shadow-inner outline-none placeholder:text-on-surface-variant/50 focus:ring-2 focus:ring-on-primary-container"
            >
            <button
              v-if="searchQuery"
              type="button"
              class="absolute right-2.5 flex h-6 w-6 items-center justify-center text-on-surface-variant/60 hover:text-on-surface"
              aria-label="Clear search"
              @click="clearSearch"
            >
              <span class="material-symbols-outlined text-[16px]" aria-hidden="true">cancel</span>
            </button>
          </div>
        </div>

        <div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar border-t border-white/10 px-3 pb-2.5 pt-2">
          <button
            type="button"
            class="flex shrink-0 items-center gap-1 rounded-full px-3 py-1 font-label text-xs font-medium whitespace-nowrap transition-all"
            :class="selectedCategory === null
              ? 'bg-white font-bold text-primary shadow-sm'
              : 'bg-white/10 text-on-primary/90 hover:bg-white/20'"
            @click="selectCategory(null)"
          >
            ทั้งหมด
          </button>
          <button
            v-for="category in categories"
            :key="category"
            type="button"
            class="flex shrink-0 items-center gap-1 rounded-full px-3 py-1 font-label text-xs font-medium whitespace-nowrap transition-all"
            :class="selectedCategory === category
              ? 'bg-white font-bold text-primary shadow-sm'
              : 'bg-white/10 text-on-primary/90 hover:bg-white/20'"
            @click="selectCategory(category)"
          >
            <span class="material-symbols-outlined text-[14px]" aria-hidden="true">{{ iconForCategory(category) }}</span>
            <span>{{ category }}</span>
          </button>
        </div>
      </div>

      <div
        v-if="showLimitBanner && !loading && !error"
        class="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 font-body text-xs text-amber-800"
      >
        <span class="material-symbols-outlined shrink-0 text-[16px] text-amber-600" aria-hidden="true">info</span>
        <span class="leading-tight">แสดงเฉพาะ {{ PRICE_LIST_RENDER_CAP.toLocaleString('th-TH') }} รายการแรก หากไม่พบกรุณาพิมพ์ค้นหาเพิ่มเติม</span>
      </div>

      <div v-if="loading" class="space-y-1 p-4" aria-busy="true" aria-label="Loading price list">
        <div class="mb-3 h-5 w-32 animate-pulse rounded bg-surface-container" />
        <div v-for="n in 6" :key="n" class="flex items-start gap-3 border-b border-outline-variant/10 py-3">
          <div class="h-11 w-11 shrink-0 animate-pulse rounded-full bg-surface-container" />
          <div class="flex-1 space-y-2">
            <div class="h-4 w-3/4 animate-pulse rounded bg-surface-container" />
            <div class="h-3 w-1/2 animate-pulse rounded bg-surface-container" />
            <div class="flex gap-2 pt-1">
              <div class="h-8 w-24 animate-pulse rounded-lg bg-surface-container" />
              <div class="h-8 w-20 animate-pulse rounded-lg bg-surface-container" />
            </div>
          </div>
        </div>
      </div>

      <div v-else-if="error" class="space-y-3 px-6 py-16 text-center">
        <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-error-container text-error">
          <span class="material-symbols-outlined picker-icon-lg" aria-hidden="true">warning</span>
        </div>
        <h3 class="font-headline text-base font-bold text-on-surface">เกิดข้อผิดพลาดในการโหลดข้อมูล</h3>
        <p class="mx-auto max-w-xs font-body text-xs text-on-surface-variant">
          ไม่สามารถดึงรายการราคาจากเซิร์ฟเวอร์ได้ในขณะนี้ กรุณาตรวจสอบการเชื่อมต่อเน็ตของคุณ
        </p>
        <button
          type="button"
          class="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 font-label text-xs font-semibold text-on-primary shadow transition hover:bg-primary/90 active:scale-95"
          @click="emit('retry')"
        >
          <span class="material-symbols-outlined text-[16px]" aria-hidden="true">refresh</span>
          ลองใหม่
        </button>
      </div>

      <div v-else-if="showEmpty" class="space-y-2 px-6 py-16 text-center">
        <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-surface-container text-on-surface-variant/60">
          <span class="material-symbols-outlined text-[28px]" aria-hidden="true">search_off</span>
        </div>
        <p class="font-body text-sm font-medium italic text-on-surface-variant">ไม่พบรายการที่ตรงกับการค้นหา</p>
        <p class="font-body text-xs text-on-surface-variant/80">ลองค้นหาด้วยคำอื่น เช่น รหัสสินค้า หรือชื่อไทย</p>
      </div>

      <div v-else class="divide-y divide-outline-variant/10">
        <section v-for="group in rendered.groups" :key="group.category">
          <div
            class="sticky z-10 flex items-center justify-between border-y border-outline-variant/20 bg-surface-container-low/95 px-4 py-2 backdrop-blur-sm"
            :style="{ top: `${headerHeight}px` }"
          >
            <div class="flex items-center gap-2">
              <span class="material-symbols-outlined text-[20px] text-primary" aria-hidden="true">{{ iconForCategory(group.category) }}</span>
              <span class="font-headline text-xs font-bold uppercase tracking-wider text-on-surface">{{ group.category }}</span>
            </div>
            <span class="rounded-full bg-surface-container px-2 py-0.5 font-label text-[11px] font-semibold text-on-surface-variant">
              {{ group.items.length }} รายการ
            </span>
          </div>
          <InvoicePriceListItemRow
            v-for="item in group.items"
            :key="item.id"
            :item="item"
            @select="emit('select', $event)"
          />
        </section>
      </div>
    </div>
  </BaseOverlay>
</template>

<style>
/* BaseOverlay teleports its <dialog>, so parent scoped :deep() cannot reach the
   built-in close button. Scope the restyle to this overlay's aria-label. */
dialog[aria-label="เลือกจากรายการราคา"] > .base-overlay-panel > button[aria-label="Close"] {
  color: #ffffff;
}
dialog[aria-label="เลือกจากรายการราคา"] > .base-overlay-panel > button[aria-label="Close"]:hover,
dialog[aria-label="เลือกจากรายการราคา"] > .base-overlay-panel > button[aria-label="Close"]:focus-visible {
  background-color: rgb(255 255 255 / 0.12);
}
</style>

<style scoped>
/* Google Fonts sets 24px on .material-symbols-outlined; only some sizes are
   pre-declared in src/style.css. Local extras for this picker. */
.material-symbols-outlined.picker-icon-lg {
  font-size: 32px;
}
</style>
