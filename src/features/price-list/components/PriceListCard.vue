<script setup lang="ts">
import { computed } from 'vue'
import ImageOrIcon from '@/shared/components/ImageOrIcon.vue'
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
</script>

<template>
  <button
    v-if="item"
    type="button"
    class="flex w-full min-w-0 items-center gap-3 bg-surface-container-lowest px-4 py-3 text-left transition-colors hover:bg-surface-container-low focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary"
    :aria-label="`ดูตัวเลือกราคา ${item.displayNameTh} รหัส ${props.itemCode} ${props.items.length} ราคา`"
    @click="emit('open', props.itemCode)"
  >
    <ImageOrIcon :image-url="props.items.find((entry) => entry.imageUrl)?.imageUrl ?? null" icon="checkroom" class="h-12 w-12 shrink-0 rounded-lg" />
    <span class="min-w-0 flex-1">
      <strong class="block truncate font-headline text-sm text-primary">{{ item.displayNameTh }}</strong>
      <span class="block truncate font-body text-xs text-on-surface-variant">{{ props.itemCode }} · {{ item.variant || item.itemType }}</span>
    </span>
    <span class="shrink-0 text-right">
      <span class="block font-label text-xs font-bold text-primary">{{ props.items.length }} ราคา</span>
      <span class="block font-body text-[11px] text-on-surface-variant">{{ activeCount }} ใช้งาน</span>
    </span>
    <span class="material-symbols-outlined shrink-0 text-[18px] text-on-surface-variant" aria-hidden="true">chevron_right</span>
  </button>
</template>
