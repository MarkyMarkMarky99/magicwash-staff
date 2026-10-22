<script setup lang="ts">
import BaseBadge from '@/shared/components/BaseBadge.vue'
import { serviceLabel, type PriceListTableCard } from '../utils/price-list-table'

defineProps<{
  card: PriceListTableCard
  showServiceLabels: boolean
}>()

const emit = defineEmits<{
  edit: [id: string]
}>()

function formatPrice(price: number): string {
  return `฿${price.toLocaleString('en-US')}`
}
</script>

<template>
  <section class="relative w-full rounded-[11px_15px_12px_14px] border-2 border-primary bg-white px-3 pb-2 pt-3.5 shadow-[4px_4px_0_color-mix(in_srgb,var(--color-primary)_70%,black)]">
    <span class="absolute -top-3 left-2.5 z-[2] -rotate-3 rounded-[6px_8px_6px_7px] bg-warning px-[9px] pb-1 pt-[3px] font-headline text-[11px] font-bold leading-[1.1] text-white shadow-[1px_1px_0_color-mix(in_srgb,var(--color-warning)_70%,black)]">{{ card.subcategory }}</span>
    <table class="w-full border-collapse font-body text-[13px]">
      <colgroup v-if="showServiceLabels">
        <col>
        <col v-for="service in card.services" :key="service" class="w-14">
      </colgroup>
      <thead v-if="showServiceLabels">
        <tr>
          <th />
          <th
            v-for="service in card.services"
            :key="service"
            scope="col"
            class="border-b border-dashed border-outline-variant pb-1.5 text-right align-bottom font-label text-[10px] font-extrabold uppercase leading-tight tracking-[0.04em] text-on-surface-variant"
          >{{ serviceLabel(service) }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in card.rows" :key="row.key" class="border-b border-dashed border-outline-variant last:border-b-0">
          <td class="py-2 align-top text-sm font-extrabold leading-snug text-primary">
            {{ row.nameTh }}
            <span v-if="row.variant" class="ml-1.5 align-[1px]"><BaseBadge :label="row.variant" size="sm" tone="warning" /></span>
            <span v-if="row.secondLine" class="block text-[11px] font-medium text-on-surface-variant">{{ row.secondLine }}</span>
          </td>
          <td v-for="service in card.services" :key="service" class="whitespace-nowrap py-2 text-right align-top text-sm">
            <button
              v-if="row.prices[service]"
              type="button"
              class="font-extrabold text-primary focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime"
              :aria-label="`Edit ${serviceLabel(service)} price of ${row.nameTh}`"
              @click="emit('edit', row.prices[service]!.id)"
            >{{ formatPrice(row.prices[service]!.price) }}</button>
            <span v-else class="font-medium text-on-surface-variant opacity-60" aria-label="No price">–</span>
          </td>
        </tr>
      </tbody>
    </table>
  </section>
</template>
