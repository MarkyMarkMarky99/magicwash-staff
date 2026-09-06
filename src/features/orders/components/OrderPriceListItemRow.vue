<script setup lang="ts">
import type { z } from 'zod'
import type { priceListListResponseSchema } from '@contracts/price-list/price-list-api.schema'
import { serviceTypePresentation } from '@/shared/utils/service-type-labels'
import { formatOrderPrice } from '@/features/orders/utils/order-price-format'

type PriceListItem = z.infer<typeof priceListListResponseSchema>

const props = defineProps<{
  item: PriceListItem
}>()

const emit = defineEmits<{
  select: [item: PriceListItem]
}>()

function detailFor(item: PriceListItem) {
  return [item.subcategory, item.itemType, item.variant].filter(Boolean).join(' · ')
}
</script>

<template>
  <button
    type="button"
    class="block w-full text-left transition-colors hover:bg-primary/[0.04] active:bg-primary/[0.08] focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-primary"
    :aria-label="`เลือก ${props.item.displayNameTh} ${props.item.variant ?? ''} ราคา ${formatOrderPrice(props.item.price)}`"
    @click="emit('select', props.item)"
  >
    <article class="flex items-start gap-3 px-4 py-3.5">
      <div class="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary" aria-hidden="true">
        <span class="material-symbols-outlined text-[22px]">checkroom</span>
      </div>

      <div class="min-w-0 flex-1">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <h3 class="truncate font-headline text-[15px] font-bold leading-snug text-on-surface">
              {{ props.item.displayNameTh }}
            </h3>
            <p v-if="detailFor(props.item)" class="mt-0.5 truncate font-body text-xs text-on-surface-variant">
              {{ detailFor(props.item) }}
            </p>
          </div>
          <strong class="shrink-0 font-headline text-lg font-extrabold tabular-nums text-primary">
            {{ formatOrderPrice(props.item.price) }}
          </strong>
        </div>

        <div class="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 font-label text-[11px] font-semibold text-on-surface-variant">
          <span class="rounded-md border border-outline-variant/45 bg-surface-container-low px-1.5 py-0.5 tracking-wide">
            {{ props.item.itemCode }}
          </span>
          <span class="inline-flex items-center gap-1">
            <span class="material-symbols-outlined text-[14px] text-primary" aria-hidden="true">{{ serviceTypePresentation[props.item.serviceType].icon }}</span>
            {{ serviceTypePresentation[props.item.serviceType].label }}
          </span>
          <span v-if="props.item.unit" class="text-on-surface-variant/80">ต่อ {{ props.item.unit }}</span>
        </div>
      </div>

      <span class="material-symbols-outlined mt-3 shrink-0 text-[18px] text-on-surface-variant/45" aria-hidden="true">chevron_right</span>
    </article>
  </button>
</template>
