<script setup lang="ts">
import { computed, ref } from 'vue'
import ImageOrIcon from '@/shared/components/ImageOrIcon.vue'
import BaseSwipeCard from '@/shared/components/BaseSwipeCard.vue'
import type { PriceListDto } from '../services/price-list.service'

const props = defineProps<{
  itemCode: string
  items: PriceListDto[]
}>()

const emit = defineEmits<{
  open: [itemCode: string]
}>()

const item = computed(() => props.items.find((entry) => entry.active) ?? props.items[0])
const activeCount = computed(() => props.items.filter((entry) => entry.active).length)
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
    role="button"
    tabindex="0"
    :aria-label="props.items.length > 1
      ? `ดูตัวเลือกราคา ${item.displayNameTh} รหัส ${props.itemCode} ${props.items.length} ราคา แตะเพื่อดูราคา หรือปัดซ้ายเพื่อแก้ไข`
      : `ราคา ${item.displayNameTh} รหัส ${props.itemCode} ปัดซ้ายหรือกด Enter เพื่อแสดงปุ่มแก้ไข`"
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

    <div class="flex min-w-0 items-center gap-3 px-4 py-3 text-left">
      <ImageOrIcon :image-url="props.items.find((entry) => entry.imageUrl)?.imageUrl ?? null" icon="checkroom" class="h-12 w-12 shrink-0 rounded-lg" />
      <span class="min-w-0 flex-1">
        <strong class="block truncate font-headline text-sm text-primary">{{ item.displayNameTh }}</strong>
        <span class="block truncate font-body text-xs text-on-surface-variant">{{ props.itemCode }} · {{ item.variant || item.itemType }}</span>
      </span>
      <span class="shrink-0 text-right">
        <span class="block font-headline text-sm font-bold text-primary">{{ props.items.length > 1 ? `${props.items.length} ราคา` : `฿${formatPrice(item.price)}` }}</span>
        <span class="block font-body text-[11px] text-on-surface-variant">{{ props.items.length > 1 ? `${activeCount} ใช้งาน` : item.active ? 'เปิดใช้งาน' : 'ปิดใช้งาน' }}</span>
      </span>
    </div>
  </BaseSwipeCard>
</template>
