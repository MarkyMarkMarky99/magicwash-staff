<script setup lang="ts">
import { computed } from 'vue'
import BaseSwipeCard from '@/shared/components/BaseSwipeCard.vue'
import { serviceTypeLabel } from '@/shared/utils/service-type-labels'
import type { PriceListDto } from '../services/price-list.service'

const props = defineProps<{
  item: PriceListDto
}>()

const emit = defineEmits<{
  edit: [id: string]
}>()

const serviceLabel = computed(() => serviceTypeLabel(props.item.serviceType) ?? '')

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
    :aria-label="`แก้ไขรายการราคา ${props.item.displayNameTh} ${serviceLabel}`"
    @tap="openEdit"
    @keydown="handleKeydown"
  >
    <div class="flex min-w-0 items-center gap-2 px-4 py-2.5">
      <span
        class="size-2 shrink-0 rounded-full"
        :class="props.item.active ? 'bg-[#2e7d32]' : 'bg-error'"
        :aria-label="props.item.active ? 'เปิดใช้งาน' : 'ปิดใช้งาน'"
        role="img"
      />

      <h3 class="min-w-0 flex-1 truncate font-headline text-[14px] font-bold leading-tight text-primary">
        {{ props.item.displayNameTh }}
      </h3>

      <span
        v-if="props.item.creditEligible"
        class="shrink-0 font-label text-[9px] font-bold text-primary"
        aria-label="ใช้เครดิตได้"
      >เครดิตได้</span>

      <span class="shrink-0 font-label text-[10px] font-semibold text-on-surface-variant">
        {{ serviceLabel }}
      </span>

      <span
        class="min-w-[68px] shrink-0 whitespace-nowrap text-right font-headline text-[15px] font-extrabold tabular-nums text-primary"
        aria-label="ราคา"
      >
        ฿{{ formatPrice(props.item.price) }}
      </span>
    </div>
  </BaseSwipeCard>
</template>
