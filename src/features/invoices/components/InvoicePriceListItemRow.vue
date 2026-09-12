<script setup lang="ts">
import type { InvoicePriceListItemDto } from '../services/invoice-price-list.service'
import BaseBadge from '@/shared/components/BaseBadge.vue'
import ImageOrIcon from '@/shared/components/ImageOrIcon.vue'
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
    class="group block min-w-0 overflow-hidden rounded-2xl border border-outline-variant/35 bg-surface text-left shadow-sm transition hover:border-primary/35 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    @click="emit('select', props.item)"
  >
    <article>
      <div class="relative">
        <ImageOrIcon
          :image-url="item.imageUrl"
          :icon="iconForCategory(item.category)"
          fit="contain"
          class="aspect-[4/3] w-full rounded-none border-0 bg-surface-container-low"
        />
        <span class="absolute right-2 top-2 rounded-md bg-surface/90 px-1.5 py-0.5 font-label text-[10px] font-semibold text-on-surface-variant shadow-sm">{{ item.itemCode }}</span>
      </div>

      <div class="space-y-2 p-3">
        <div class="min-w-0">
          <h3 class="line-clamp-2 min-h-10 font-headline text-sm font-bold leading-5 text-on-surface">
            {{ item.displayNameTh }}
          </h3>
          <p class="mt-0.5 truncate font-body text-[11px] text-on-surface-variant">
            {{ [item.subcategory, item.itemType, item.variant].filter(Boolean).join(' · ') || item.itemCode }}
          </p>
        </div>

        <div class="flex items-center justify-between gap-2">
          <strong class="shrink-0 font-headline text-lg font-extrabold tabular-nums text-primary">
            {{ formatBaht(item.price) }}
          </strong>
          <BaseBadge v-if="item.creditEligible" label="เครดิตได้" size="xs" tone="info" />
        </div>

        <div class="flex min-w-0 items-center gap-1.5 font-label text-[10px] font-semibold text-primary">
          <span class="material-symbols-outlined text-[14px]" aria-hidden="true">{{ serviceIcon(item.serviceType) }}</span>
          <span class="truncate">{{ serviceLabel(item.serviceType) }} · {{ item.priceGroup }}</span>
        </div>

        <div class="flex items-center justify-between gap-1 font-body text-[10px] text-on-surface-variant/75">
          <p class="flex min-w-0 items-center gap-1 truncate">
            <span class="material-symbols-outlined text-[11px]" aria-hidden="true">calendar_today</span>
            <span class="truncate">{{ formatEffectiveRange(item.effectiveFrom, item.effectiveTo) }}</span>
          </p>
          <span v-if="item.unit" class="shrink-0">ต่อ {{ item.unit }}</span>
        </div>
      </div>
    </article>
  </button>
</template>
