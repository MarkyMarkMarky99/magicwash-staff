<script setup lang="ts">
import type { InvoicePriceListItemDto } from '../services/invoice-price-list.service'
import BaseBadge from '@/shared/components/BaseBadge.vue'
import {
  formatBaht,
  formatEffectiveRange,
  iconForCategory,
  serviceIcon,
  serviceLabel,
} from '../utils/invoice-price-list.utils'

const props = defineProps<{
  item: InvoicePriceListItemDto
}>()

const emit = defineEmits<{
  select: [item: InvoicePriceListItemDto]
}>()
</script>

<template>
  <button
    type="button"
    class="block w-full text-left transition-colors hover:bg-surface-container-low focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-primary"
    @click="emit('select', props.item)"
  >
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
            <BaseBadge v-if="item.creditEligible" label="เครดิตได้" size="xs" tone="info" class="ml-0.5" />
          </div>

          <div class="flex items-center gap-1 font-body text-[11px] text-on-surface-variant/80">
            <span class="material-symbols-outlined text-[11px] text-on-surface-variant/70" aria-hidden="true">calendar_today</span>
            <span>{{ formatEffectiveRange(item.effectiveFrom, item.effectiveTo) }}</span>
          </div>
        </div>
      </div>

      <div class="flex items-center justify-between gap-3 pl-[56px]">
        <div class="flex min-w-0 items-center gap-1.5 font-label text-xs font-semibold text-primary">
          <span class="material-symbols-outlined text-[16px]" aria-hidden="true">{{ serviceIcon(item.serviceType) }}</span>
          <span class="truncate">{{ serviceLabel(item.serviceType) }} · {{ item.priceGroup }}</span>
          <span v-if="item.unit" class="shrink-0 text-on-surface-variant">· {{ item.unit }}</span>
        </div>
        <strong class="shrink-0 font-headline text-xl font-extrabold tabular-nums text-primary">
          {{ formatBaht(item.price) }}
        </strong>
      </div>
    </article>
  </button>
</template>
