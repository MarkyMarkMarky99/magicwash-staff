<script setup lang="ts">
import BaseSwipeCard from '@/shared/components/BaseSwipeCard.vue'
import CardLeadingIcon from '@/shared/components/CardLeadingIcon.vue'
import type { PriceListDto } from '../services/price-list.service'

const props = defineProps<{
  item: PriceListDto
}>()

const emit = defineEmits<{
  edit: [id: string]
}>()

function formatPrice(value: number): string {
  return new Intl.NumberFormat('th-TH').format(value)
}

function openEdit() {
  emit('edit', props.item.id)
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key !== 'Enter' && event.key !== ' ') return
  event.preventDefault()
  openEdit()
}
</script>

<template>
  <BaseSwipeCard
    role="button"
    tabindex="0"
    :aria-label="`แก้ไขรายการราคา ${props.item.displayNameTh}`"
    @tap="openEdit"
    @keydown="handleKeydown"
  >
    <div class="px-4 py-3 flex gap-3">
      <CardLeadingIcon icon="local_laundry_service" label="Price list item" />

      <div class="flex-grow min-w-0 flex flex-col justify-center">
        <div class="flex items-center gap-1.5 mb-0.5 min-w-0">
          <h3 class="font-headline font-bold text-primary text-[14px] leading-tight truncate">
            {{ props.item.displayNameTh }}
          </h3>
          <span
            v-if="props.item.creditEligible"
            class="font-label text-[9px] font-bold text-primary shrink-0"
            aria-label="ใช้เครดิตได้"
          >เครดิตได้</span>
        </div>

        <p class="font-body text-xs text-on-surface-variant truncate">
          {{ props.item.itemCode }} · {{ props.item.category }} · {{ props.item.subcategory }}
          <template v-if="props.item.variant"> · {{ props.item.variant }}</template>
        </p>

        <p class="font-body text-xs text-on-surface-variant truncate" aria-label="ราคาตามบริการ">
          <span v-if="props.item.washDryIronPrice !== null">ซักอบรีด ฿{{ formatPrice(props.item.washDryIronPrice) }}</span>
          <span v-if="props.item.ironOnlyPrice !== null"> · รีด ฿{{ formatPrice(props.item.ironOnlyPrice) }}</span>
          <span v-if="props.item.dryCleanPrice !== null"> · ดรายคลีน ฿{{ formatPrice(props.item.dryCleanPrice) }}</span>
          <span v-if="props.item.washDryIronPrice === null && props.item.ironOnlyPrice === null && props.item.dryCleanPrice === null">ยังไม่กำหนดราคา</span>
        </p>
      </div>
    </div>
  </BaseSwipeCard>
</template>
