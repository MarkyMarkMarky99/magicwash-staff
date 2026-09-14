<script setup lang="ts">
import { computed, ref } from 'vue'
import ImageContentCard from '@/shared/components/ImageContentCard.vue'
import BaseSwipeCard from '@/shared/components/BaseSwipeCard.vue'
import type { PriceListDto } from '@/data/price-list/price-list.service'

const props = defineProps<{
  itemCode: string
  items: PriceListDto[]
}>()

const emit = defineEmits<{
  open: [itemCode: string]
}>()

const item = computed(() => props.items[0])
const imageUrl = computed(() => props.items.find((entry) => entry.imageUrl)?.imageUrl ?? null)
const priceLabel = computed(() => {
  const prices = props.items.map((entry) => entry.price)
  const lowest = Math.min(...prices)
  const highest = Math.max(...prices)
  return lowest === highest
    ? `฿${formatPrice(lowest)}`
    : `฿${formatPrice(lowest)}–${formatPrice(highest)}`
})
const baseCard = ref<InstanceType<typeof BaseSwipeCard> | null>(null)

function showEditAction(): void {
  baseCard.value?.snapCard('left')
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.target !== event.currentTarget) return
  event.preventDefault()
  if (props.items.length > 1) emit('open', props.itemCode)
  else showEditAction()
}

function formatPrice(price: number): string {
  return new Intl.NumberFormat('th-TH').format(price)
}
</script>

<template>
  <BaseSwipeCard
    v-if="item"
    ref="baseCard"
    :style="{ '--snap-left': '6rem' }"
    class="min-w-0 overflow-hidden rounded-2xl"
    role="button"
    tabindex="0"
    :aria-label="props.items.length > 1
      ? `ดูตัวเลือกราคา ${item.displayNameTh} รหัส ${props.itemCode} ${props.items.length} ราคา ${priceLabel} แตะเพื่อดูราคา หรือปัดซ้ายเพื่อแก้ไข`
      : `ราคา ${item.displayNameTh} รหัส ${props.itemCode} ${priceLabel} ปัดซ้ายหรือกด Enter เพื่อแสดงปุ่มแก้ไข`"
    @tap="props.items.length > 1 && emit('open', props.itemCode)"
    @swipe-right="baseCard?.snapCard('none')"
    @keydown.enter="handleKeydown"
    @keydown.space="handleKeydown"
  >
    <template #left-panel="{ snapped }">
      <div class="absolute inset-0 flex items-center justify-end bg-primary/80 pr-4 text-on-primary">
        <button type="button" class="flex min-h-11 items-center gap-1 font-label text-xs font-bold focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-white" :class="snapped === 'left' ? '' : 'pointer-events-none'" :tabindex="snapped === 'left' ? 0 : -1" :aria-hidden="snapped !== 'left'" :aria-label="`แก้ไขราคา ${item.displayNameTh}`" @click="emit('open', props.itemCode)">
          <span class="material-symbols-outlined text-[18px]" aria-hidden="true">edit</span>แก้ไข
        </button>
      </div>
    </template>

    <ImageContentCard :image-url="imageUrl" :title="item.displayNameTh" icon="checkroom">
      <template #badge>
        <span class="price-on-image font-headline text-[14px] font-extrabold tabular-nums text-primary">{{ priceLabel }}</span>
      </template>
      <span class="block truncate font-body text-[11px] text-on-surface-variant">{{ props.itemCode }}</span>
    </ImageContentCard>
  </BaseSwipeCard>
</template>

<style scoped>
.price-on-image {
  text-shadow: 0 0 2px #fff, 0 0 6px rgba(255, 255, 255, 0.95);
}
</style>
