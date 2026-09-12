<script setup lang="ts">
import type { z } from 'zod'
import type { priceListListResponseSchema } from '@contracts/price-list/price-list-api.schema'
import { serviceTypePresentation } from '@/shared/utils/service-type-labels'
import { formatOrderPrice } from '@/features/orders/utils/order-price-format'
import ImageOrIcon from '@/shared/components/ImageOrIcon.vue'

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
    class="group block min-w-0 overflow-hidden rounded-2xl border border-outline-variant/35 bg-surface text-left shadow-sm transition hover:border-primary/35 hover:shadow-md active:bg-primary/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    :aria-label="`เลือก ${props.item.displayNameTh} ${props.item.variant ?? ''} ราคา ${formatOrderPrice(props.item.price)}`"
    @click="emit('select', props.item)"
  >
    <article>
      <div class="relative">
        <ImageOrIcon
          :image-url="props.item.imageUrl"
          icon="checkroom"
          fit="contain"
          class="aspect-[4/3] w-full rounded-none border-0 bg-surface-container-low"
        />
        <span class="absolute right-2 top-2 rounded-md bg-surface/90 px-1.5 py-0.5 font-label text-[10px] font-semibold text-on-surface-variant shadow-sm">{{ props.item.itemCode }}</span>
      </div>

      <div class="space-y-2 p-3">
        <div class="min-w-0">
          <h3 class="line-clamp-2 min-h-10 font-headline text-sm font-bold leading-5 text-on-surface">
            {{ props.item.displayNameTh }}
          </h3>
          <p class="mt-0.5 truncate font-body text-[11px] text-on-surface-variant">
            {{ detailFor(props.item) || props.item.itemCode }}
          </p>
        </div>

        <div class="flex items-end justify-between gap-2">
          <strong class="font-headline text-lg font-extrabold tabular-nums text-primary">
            {{ formatOrderPrice(props.item.price) }}
          </strong>
          <span v-if="props.item.unit" class="mb-0.5 shrink-0 font-label text-[10px] font-semibold text-on-surface-variant">ต่อ {{ props.item.unit }}</span>
        </div>

        <div class="flex min-w-0 items-center gap-1.5 font-label text-[10px] font-semibold text-primary">
          <span class="material-symbols-outlined text-[14px]" aria-hidden="true">{{ serviceTypePresentation[props.item.serviceType].icon }}</span>
          <span class="truncate">{{ serviceTypePresentation[props.item.serviceType].label }}</span>
        </div>
      </div>
    </article>
  </button>
</template>
