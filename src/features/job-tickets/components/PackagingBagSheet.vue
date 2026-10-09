<script setup lang="ts">
import CloseButton from '@/shared/components/CloseButton.vue'
import SquareImageCard from '@/shared/components/SquareImageCard.vue'
import DetailOverlay from '@/shared/layouts/DetailOverlay.vue'
import type { GarmentState, PackagingGarment } from '../packaging-bags'

defineProps<{
  open: boolean
  bagNumber: number
  selectedCount: number
  cards: readonly { garment: PackagingGarment; state: GarmentState }[]
}>()
const emit = defineEmits<{ close: []; toggle: [tagId: string]; scan: [] }>()

function blockedLabel(state: GarmentState): string | null {
  if (state.kind === 'inBag') return `In Bag ${state.bagNumber}`
  if (state.kind === 'waiting') return `Waiting: ${state.label}`
  return null
}
</script>

<template>
  <DetailOverlay :open="open" :ariaLabel="`Bag ${bagNumber}`" size="auto" :close-button="false" @close="emit('close')">
    <template #header>
      <div class="flex items-center justify-between gap-3 px-4 pb-3 pt-1">
        <div class="min-w-0 border-l-4 border-lime pl-2.5">
          <h2 class="font-headline text-[17px] font-extrabold tracking-[-0.03em] text-primary">Bag {{ bagNumber }}</h2>
          <p class="mt-[3px] font-label text-[9px] font-bold uppercase leading-none tracking-[0.1em] text-on-surface-variant">{{ selectedCount }} selected · tap a garment to add</p>
        </div>
        <CloseButton icon="qr_code_scanner" label="Scan tag" tone="onDark" @click="emit('scan')" />
      </div>
    </template>
    <p v-if="!cards.length" class="px-4 py-6 text-center font-body text-sm text-on-surface-variant">No garments left to add</p>
    <div v-else class="grid grid-cols-3 content-start gap-2.5 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-1.5">
      <button
        v-for="{ garment, state } in cards"
        :key="garment.tagId"
        type="button"
        class="relative min-w-0 rounded-xl focus-visible:outline-2 focus-visible:outline-lime"
        :class="[state.kind === 'selected' ? 'ring-4 ring-lime' : '', blockedLabel(state) ? 'cursor-not-allowed' : '']"
        :disabled="blockedLabel(state) !== null"
        :aria-pressed="state.kind === 'selected'"
        :aria-label="`Garment ${garment.tagId}${blockedLabel(state) ? `, ${blockedLabel(state)}` : ''}`"
        @click="emit('toggle', garment.tagId)"
      >
        <span class="block" :class="blockedLabel(state) ? 'opacity-40 saturate-0' : ''">
          <SquareImageCard :image-url="garment.imageUrl" :primary-text="garment.tagId" />
        </span>
        <span v-if="blockedLabel(state)" class="absolute inset-x-0 top-0 flex aspect-square items-center justify-center px-1">
          <span class="rounded-lg bg-white/90 px-1 py-1 text-center font-label text-[10px] font-extrabold leading-tight text-on-surface">{{ blockedLabel(state) }}</span>
        </span>
        <span v-if="state.kind === 'selected'" class="material-symbols-outlined absolute right-2 top-2 rounded-full bg-lime p-1 text-primary" aria-hidden="true">check</span>
      </button>
    </div>
  </DetailOverlay>
</template>
