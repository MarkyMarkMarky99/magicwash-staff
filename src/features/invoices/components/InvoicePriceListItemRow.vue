<script setup lang="ts">
import type { InvoicePriceListItemDto } from '../services/invoice-price-list.service'
import {
  availableServices,
  formatBaht,
  formatEffectiveRange,
  iconForCategory,
  type PriceListServiceKey,
} from '../utils/invoice-price-list.utils'

const props = defineProps<{
  item: InvoicePriceListItemDto
}>()

const emit = defineEmits<{
  select: [payload: { item: InvoicePriceListItemDto; serviceKey: PriceListServiceKey }]
}>()

const CHIP_CLASS: Record<PriceListServiceKey, string> = {
  washDryIronPrice:
    'bg-secondary-container/70 text-primary border-secondary/25 hover:bg-primary hover:text-on-primary hover:border-primary',
  ironOnlyPrice:
    'bg-amber-50 text-amber-900 border-amber-200/80 hover:bg-amber-700 hover:text-white hover:border-amber-700',
  dryCleanPrice:
    'bg-tertiary-container/35 text-tertiary border-tertiary/25 hover:bg-tertiary hover:text-on-tertiary hover:border-tertiary',
}

function onSelect(serviceKey: PriceListServiceKey) {
  emit('select', { item: props.item, serviceKey })
}
</script>

<template>
  <article class="flex flex-col gap-2 px-4 py-3">
    <div class="flex items-start gap-3">
      <div
        class="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-outline-variant/10 bg-primary/10 text-primary"
        aria-hidden="true"
      >
        <span class="material-symbols-outlined text-[22px]">{{ iconForCategory(item.category) }}</span>
      </div>

      <div class="min-w-0 flex-1 space-y-1">
        <h3 class="truncate font-headline text-[15px] font-bold leading-snug text-on-surface">
          {{ item.displayNameTh }}
        </h3>

        <div class="flex flex-wrap items-center gap-1.5 font-body text-xs font-medium text-on-surface-variant">
          <span class="rounded border border-outline-variant/40 bg-surface-container px-1.5 py-px font-label text-[11px] font-semibold tracking-wide text-on-surface-variant">
            {{ item.itemCode }}
          </span>
          <span aria-hidden="true">•</span>
          <span>{{ item.subcategory }}</span>
          <span v-if="item.itemType" class="text-on-surface-variant/80">· {{ item.itemType }}</span>
          <span v-if="item.variant" class="text-on-surface-variant/70">({{ item.variant }})</span>
          <span
            v-if="item.creditEligible"
            class="ml-0.5 inline-flex items-center rounded-full bg-blue-50 px-1.5 py-px font-label text-[10px] font-medium text-blue-700"
          >
            เครดิตได้
          </span>
        </div>

        <div class="flex items-center gap-1 font-body text-[11px] text-on-surface-variant/80">
          <span class="material-symbols-outlined text-[11px] text-on-surface-variant/70" aria-hidden="true">calendar_today</span>
          <span>{{ formatEffectiveRange(item.effectiveFrom, item.effectiveTo) }}</span>
        </div>
      </div>
    </div>

    <div class="flex items-center gap-2 overflow-x-auto no-scrollbar pl-[56px]">
      <button
        v-for="service in availableServices(item)"
        :key="service.key"
        type="button"
        class="inline-flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-1.5 font-label text-xs font-semibold shadow-sm transition-all active:scale-95"
        :class="CHIP_CLASS[service.key]"
        @click="onSelect(service.key)"
      >
        <span class="material-symbols-outlined text-[16px]" aria-hidden="true">{{ service.icon }}</span>
        <span>{{ service.label }}</span>
        <span class="ml-0.5 text-[13px] font-bold">{{ formatBaht(service.price) }}</span>
      </button>
    </div>
  </article>
</template>
