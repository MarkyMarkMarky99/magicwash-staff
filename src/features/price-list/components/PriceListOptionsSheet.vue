<script setup lang="ts">
import { computed } from 'vue'
import DetailOverlay from '@/shared/layouts/DetailOverlay.vue'
import { serviceTypeLabel } from '@/shared/utils/service-type-labels'
import type { PriceListDto } from '@/data/price-list/price-list.service'

const props = defineProps<{
  open: boolean
  itemCode: string | null
  items: PriceListDto[]
  serviceType: string | null
}>()

const emit = defineEmits<{
  close: []
  select: [id: string]
}>()

const item = computed(() => props.items[0])
const hasDifferentServices = computed(() => new Set(props.items.map((option) => option.serviceType)).size > 1)
const hasDifferentUnits = computed(() => new Set(props.items.map((option) => option.unit)).size > 1)
const options = computed(() => [...props.items].sort((a, b) => {
  if (a.serviceType === props.serviceType && b.serviceType !== props.serviceType) return -1
  if (b.serviceType === props.serviceType && a.serviceType !== props.serviceType) return 1
  if (a.active !== b.active) return a.active ? -1 : 1
  return a.serviceType.localeCompare(b.serviceType) || a.price - b.price
}))

function needsDisambiguation(option: PriceListDto): boolean {
  return props.items.some((other) => other.id !== option.id
    && other.price === option.price
    && other.serviceType === option.serviceType
    && other.unit === option.unit)
}

function formatPrice(price: number): string {
  return new Intl.NumberFormat('th-TH').format(price)
}
</script>

<template>
  <DetailOverlay
    :open="props.open"
    size="auto"
    panel-class="app-column"
    :ariaLabel="`เลือกราคา ${item?.displayNameTh ?? props.itemCode ?? ''}`"
    @close="emit('close')"
  >
    <template #header>
      <header class="border-b border-outline-variant/20 px-4 pb-3 pr-14 pt-1">
        <p class="font-label text-xs text-on-surface-variant">เลือกราคาที่ต้องการแก้ไข</p>
        <h2 class="mt-1 truncate font-headline text-lg font-bold text-primary">{{ item?.displayNameTh }}</h2>
        <p class="font-body text-xs text-on-surface-variant">{{ props.itemCode }}</p>
      </header>
    </template>

      <div class="p-3">
        <div class="overflow-hidden rounded-xl border border-outline-variant/30 bg-surface-container-lowest">
          <button
            v-for="option in options"
            :key="option.id"
            type="button"
            class="flex min-h-14 w-full items-center gap-3 border-b border-outline-variant/20 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-surface-container-low focus-visible:relative focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-primary"
            :aria-label="`เลือกราคา ${formatPrice(option.price)} บาท${hasDifferentServices ? ` ${serviceTypeLabel(option.serviceType)}` : ''}${!option.active ? ' ปิดใช้งาน' : ''}${needsDisambiguation(option) ? ` รหัสราคา ${option.id}` : ''}`"
            @click="emit('select', option.id)"
          >
            <span class="min-w-0 flex-1">
              <strong class="block font-headline text-lg font-bold tabular-nums text-primary">฿{{ formatPrice(option.price) }}</strong>
              <span v-if="hasDifferentServices || hasDifferentUnits || needsDisambiguation(option) || !option.active" class="block font-body text-xs text-on-surface-variant">
                <template v-if="hasDifferentServices">{{ serviceTypeLabel(option.serviceType) }}</template>
                <template v-if="hasDifferentUnits">{{ hasDifferentServices ? ' · ' : '' }}ต่อ {{ option.unit }}</template>
                <template v-if="needsDisambiguation(option)">{{ hasDifferentServices || hasDifferentUnits ? ' · ' : '' }}เริ่ม {{ option.effectiveFrom }}<template v-if="option.effectiveTo"> ถึง {{ option.effectiveTo }}</template> · {{ option.creditEligible ? 'เครดิตได้' : 'ไม่รับเครดิต' }} · {{ option.priceGroup }} · #{{ option.id }}</template>
                <template v-if="!option.active">{{ hasDifferentServices || hasDifferentUnits || needsDisambiguation(option) ? ' · ' : '' }}ปิดใช้งาน</template>
              </span>
            </span>
            <span class="material-symbols-outlined shrink-0 text-[20px] text-primary" aria-hidden="true">chevron_right</span>
          </button>
        </div>
      </div>
  </DetailOverlay>
</template>
