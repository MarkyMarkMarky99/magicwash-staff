<script setup lang="ts">
import { computed } from 'vue'
import { DELIVERY_TRACKING_ROUTE_NAME } from '../utils/delivery-tracking'
import type { DeliveryTrackingBag } from '../delivery-tracking.types'

const props = defineProps<{
  current: DeliveryTrackingBag
  otherBags: DeliveryTrackingBag[]
}>()

const bags = computed(() => [props.current, ...props.otherBags].sort((a, b) => a.bagIndex - b.bagIndex))
</script>

<template>
  <section class="mb-[26px]">
    <h2 class="mb-2.5 mt-0 text-xs font-semibold uppercase tracking-[0.08em] text-on-surface-variant">Bags in this order</h2>
    <ul class="m-0 grid list-none grid-cols-3 gap-2 p-0">
      <li v-for="bag in bags" :key="bag.orderImageId">
        <span
          v-if="bag.orderImageId === current.orderImageId"
          aria-current="true"
          class="flex flex-col items-stretch gap-1.5 rounded-[10px] border border-black bg-black p-2 text-white"
        >
          <span class="block aspect-[3/4] overflow-hidden rounded-md bg-gradient-to-b from-surface-container-highest to-outline-variant opacity-90" aria-hidden="true">
            <img v-if="bag.thumbnailUrl" :src="bag.thumbnailUrl" alt="" class="h-full w-full object-cover">
          </span>
          <span class="text-[11px] font-medium text-white/80">Bag {{ bag.bagIndex }} · this one</span>
          <span class="heavy text-[17px] leading-none">{{ bag.weightKg }}<small class="text-[11px]"> kg</small></span>
        </span>
        <RouterLink
          v-else
          :to="{ name: DELIVERY_TRACKING_ROUTE_NAME, params: { orderImageId: bag.orderImageId } }"
          :aria-label="`Bag ${bag.bagIndex}, ${bag.weightKg} kilograms`"
          class="flex flex-col items-stretch gap-1.5 rounded-[10px] border border-outline-variant bg-surface-container-lowest p-2 text-on-surface no-underline hover:border-primary-container focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-lime"
        >
          <span class="block aspect-[3/4] overflow-hidden rounded-md bg-gradient-to-b from-surface-container-highest to-outline-variant" aria-hidden="true">
            <img v-if="bag.thumbnailUrl" :src="bag.thumbnailUrl" alt="" class="h-full w-full object-cover">
          </span>
          <span class="text-[11px] font-medium text-on-surface-variant">Bag {{ bag.bagIndex }}</span>
          <span class="heavy text-[17px] leading-none">{{ bag.weightKg }}<small class="text-[11px]"> kg</small></span>
        </RouterLink>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.heavy {
  font-family: "Arial Black", "Archivo Black", Arial, sans-serif;
}
</style>
