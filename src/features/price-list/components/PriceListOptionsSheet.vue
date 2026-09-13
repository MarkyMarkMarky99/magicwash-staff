<script setup lang="ts">
import { computed } from 'vue'
import BaseSwipeCard from '@/shared/components/BaseSwipeCard.vue'
import DetailOverlay from '@/shared/layouts/DetailOverlay.vue'
import { serviceTypeLabel } from '@/shared/utils/service-type-labels'
import type { PriceListDto } from '../services/price-list.service'

const props = defineProps<{
  open: boolean
  itemCode: string | null
  items: PriceListDto[]
  serviceType: string | null
  loading: boolean
  error: string | null
}>()

const emit = defineEmits<{
  close: []
  edit: [id: string]
}>()

const item = computed(() => props.items[0])
const options = computed(() => [...props.items].sort((a, b) => {
  if (a.serviceType === props.serviceType && b.serviceType !== props.serviceType) return -1
  if (b.serviceType === props.serviceType && a.serviceType !== props.serviceType) return 1
  if (a.active !== b.active) return a.active ? -1 : 1
  return a.serviceType.localeCompare(b.serviceType) || a.price - b.price
}))

function formatPrice(price: number): string {
  return new Intl.NumberFormat('th-TH').format(price)
}
</script>

<template>
  <DetailOverlay :open="props.open" :ariaLabel="`ตัวเลือกราคา ${item?.displayNameTh ?? props.itemCode ?? ''}`" @close="emit('close')">
    <template #header>
      <header class="border-b border-outline-variant/20 px-4 pb-3 pr-14 pt-1">
        <p class="font-label text-xs text-on-surface-variant">{{ item?.category }} · {{ item?.subcategory }}</p>
        <h2 class="mt-1 font-headline text-lg font-bold text-primary">{{ item?.displayNameTh }}</h2>
        <p class="font-body text-xs text-on-surface-variant">{{ props.itemCode }} · {{ props.items.length }} ราคา</p>
      </header>
    </template>

    <div v-if="props.loading" class="p-6 text-sm text-on-surface-variant" role="status">กำลังโหลดตัวเลือกราคา…</div>
    <div v-else-if="props.error" class="p-6 text-sm text-error" role="alert">{{ props.error }}</div>
    <div v-else-if="options.length === 0" class="p-6 text-sm text-on-surface-variant">ไม่พบรายการราคาสำหรับรหัสนี้</div>
    <div v-else class="space-y-2 p-4">
      <p class="font-body text-xs text-on-surface-variant">ปัดแถวราคาไปทางซ้ายเพื่อแก้ไข</p>
      <BaseSwipeCard
        v-for="option in options"
        :key="option.id"
        class="overflow-hidden rounded-xl border border-outline-variant/30"
        :style="{ '--snap-left': '6rem' }"
      >
        <template #left-panel="{ snapped }">
          <div class="absolute inset-0 flex items-center justify-end bg-primary pr-4">
            <button v-if="snapped === 'left'" type="button" class="flex min-h-11 items-center gap-1 font-label text-xs font-bold text-on-primary focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-white" :aria-label="`แก้ไขราคา ${serviceTypeLabel(option.serviceType)} ${formatPrice(option.price)} บาท`" @click="emit('edit', option.id)">
              <span class="material-symbols-outlined text-[18px]" aria-hidden="true">edit</span>แก้ไข
            </button>
          </div>
        </template>

        <div class="flex min-w-0 items-center gap-3 px-3 py-3">
          <span class="size-2 shrink-0 rounded-full" :class="option.active ? 'bg-success' : 'bg-error'" aria-hidden="true" />
          <span class="min-w-0 flex-1">
            <strong class="block font-headline text-sm text-primary">{{ serviceTypeLabel(option.serviceType) }}</strong>
            <span class="block font-body text-[11px] text-on-surface-variant">{{ option.active ? 'เปิดใช้งาน' : 'ปิดใช้งาน' }} · เริ่ม {{ option.effectiveFrom }}<template v-if="option.effectiveTo"> · ถึง {{ option.effectiveTo }}</template></span>
            <span v-if="option.creditEligible" class="block font-body text-[11px] text-primary">ใช้เครดิตได้</span>
          </span>
          <span class="shrink-0 text-right">
            <strong class="block font-headline text-base font-bold tabular-nums text-primary">฿{{ formatPrice(option.price) }}</strong>
            <span class="block font-body text-[11px] text-on-surface-variant">ต่อ {{ option.unit }}</span>
          </span>
          <button type="button" class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-primary hover:bg-primary/10 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-primary" :aria-label="`แก้ไขราคา ${serviceTypeLabel(option.serviceType)} ${formatPrice(option.price)} บาท`" @touchend.stop @click="emit('edit', option.id)">
            <span class="material-symbols-outlined text-[18px]" aria-hidden="true">edit</span>
          </button>
        </div>
      </BaseSwipeCard>
    </div>
  </DetailOverlay>
</template>
