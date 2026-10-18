<script setup lang="ts">
import { computed } from 'vue'
import { MAX_ORDER_IMAGE_WEIGHT_KG } from '@shared/utils/item-quantity'
import CloseButton from '@/shared/components/CloseButton.vue'
import PhotoCapturePanel from '@/shared/components/PhotoCapturePanel.vue'
import SquareImageCard from '@/shared/components/SquareImageCard.vue'
import StickerFab from '@/shared/components/StickerFab.vue'
import WeightField from '@/shared/components/WeightField.vue'
import DetailOverlay from '@/shared/layouts/DetailOverlay.vue'
import { bagWeightValid, type GarmentState, type PackagingGarment } from '../packaging-bags'

const props = defineProps<{
  loading?: boolean
  open: boolean
  bagNumber: number
  selectedCount: number
  photoUrl: string | null
  weight: string
  uploading: boolean
  cards: readonly { garment: PackagingGarment; name: string; state: GarmentState }[]
}>()
const emit = defineEmits<{ close: []; toggle: [tagId: string]; scan: []; photo: []; 'update:weight': [value: string] }>()

// An empty weight allows a pack photo; invalid typed weight blocks the sticker.
const weightValid = computed(() => bagWeightValid({ weight: props.weight }))
const weightError = computed(() => props.weight.trim() && !weightValid.value
  ? `Enter a weight greater than 0 and up to ${MAX_ORDER_IMAGE_WEIGHT_KG} kg, with at most 1 decimal place` : null)

function blockedLabel(state: GarmentState): string | null {
  if (state.kind === 'inBag') return `In Bag ${state.bagNumber}`
  if (state.kind === 'waiting') return `Waiting: ${state.label}`
  return null
}
</script>

<template>
  <DetailOverlay :open="open" :ariaLabel="`Bag ${bagNumber}`" size="auto" :close-button="false" @close="emit('close')">
    <template #header>
      <!-- Pulled up over the sheet's 44px drag-handle row so the title sits 18px from the top, as in the wash-queue sheet; pointer-events stay off so the handle still drags. -->
      <header class="pointer-events-none relative -mt-[26px] px-5 pb-2 pr-16">
        <h2 class="font-headline text-[22px] font-extrabold leading-[1.15] text-primary">Bag {{ bagNumber }}</h2>
        <p class="mt-1.5 font-body text-sm leading-snug text-on-surface-variant">Put the garments in the bag, take a photo of it, then add the garments below.</p>
        <CloseButton class="pointer-events-auto absolute -top-1.5 right-4 text-on-surface-variant" @click="emit('close')" />
      </header>
    </template>
    <div class="px-4 pb-1 pt-1.5">
      <PhotoCapturePanel class="max-h-[200px]" :photo-url="photoUrl ?? ''" :uploading="uploading" title="No photo yet" hint="Weigh the bag, then tap Photo." :alt="`Bag ${bagNumber} photo`" />
      <WeightField class="bag-weight" :model-value="weight" :input-id="`bag-weight-${bagNumber}`" :error="weightError" @update:model-value="emit('update:weight', $event)">
        <template #action>
          <StickerFab class="bag-photo mr-1 shrink-0 !h-[47px] !w-[47px] !rounded-[15px_18px_16px_17px]" :class="{ done: photoUrl && !uploading }" :label="photoUrl ? 'Retake' : 'Photo'" :aria-label="photoUrl ? 'Retake photo' : 'Take photo'" :saving="uploading" saving-label="Uploading" :disabled="!weightValid || loading" @click="emit('photo')">
            <span class="material-symbols-outlined text-[20px] leading-none" aria-hidden="true">{{ photoUrl ? 'flip_camera_ios' : 'photo_camera' }}</span>
          </StickerFab>
        </template>
      </WeightField>
    </div>
    <div class="bag-sec">
      <div class="bag-sec__bar" />
      <div class="min-w-0 flex-1">
        <h3 class="bag-sec__title">Garments</h3>
        <small class="bag-sec__sub">{{ selectedCount }} selected · tap a garment to add</small>
      </div>
      <button type="button" class="bag-scan" aria-label="Scan tag" @click="emit('scan')"><span class="material-symbols-outlined" aria-hidden="true">qr_code_scanner</span></button>
    </div>
    <p v-if="!cards.length" class="px-4 py-6 text-center font-body text-sm text-on-surface-variant">No garments left to add</p>
    <div v-else class="grid grid-cols-3 content-start gap-2.5 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-1.5">
      <button
        v-for="{ garment, name, state } in cards"
        :key="garment.tagId"
        type="button"
        class="relative min-w-0 rounded-xl focus-visible:outline-2 focus-visible:outline-lime"
        :class="[state.kind === 'selected' ? 'ring-4 ring-lime' : '', loading || blockedLabel(state) ? 'cursor-not-allowed' : '']"
        :disabled="loading || blockedLabel(state) !== null"
        :aria-pressed="state.kind === 'selected'"
        :aria-label="`${name}${blockedLabel(state) ? `, ${blockedLabel(state)}` : ''}`"
        @click="emit('toggle', garment.tagId)"
      >
        <span class="block" :class="loading || blockedLabel(state) ? 'opacity-40 saturate-0' : ''">
          <SquareImageCard :image-url="garment.imageUrl" :primary-text="name" />
        </span>
        <span v-if="blockedLabel(state)" class="absolute inset-x-0 top-0 flex aspect-square items-center justify-center px-1">
          <span class="rounded-lg bg-white/90 px-1 py-1 text-center font-label text-[10px] font-extrabold leading-tight text-on-surface">{{ blockedLabel(state) }}</span>
        </span>
        <span v-if="state.kind === 'selected'" class="material-symbols-outlined absolute right-2 top-2 rounded-full bg-lime p-1 text-primary" aria-hidden="true">check</span>
      </button>
    </div>
  </DetailOverlay>
</template>

<style scoped>
.bag-weight {
  padding: 18px 0 0;
}

/* Photo taken: the sticker turns dark and offers a retake, as in the wash-queue booking sheet. */
.bag-photo.done:not(:disabled) {
  background: var(--color-primary);
  color: var(--color-lime);
}

.bag-photo.done:not(:disabled) :deep(.sticker-label) {
  color: #fff;
}

/* Section header and scan sticker match the wash-queue booking sheet (wash-program.css .sec, WashQueueMachineMenu). */
.bag-sec {
  display: flex;
  align-items: center;
  margin: 20px 16px 8px;
}

.bag-sec__bar {
  align-self: stretch;
  width: 4px;
  margin-right: 10px;
  border-radius: 2px;
  background: var(--color-lime);
}

.bag-sec__title {
  margin: 0;
  font: 800 20px/1.1 var(--font-headline);
  color: var(--color-primary);
}

.bag-sec__sub {
  display: block;
  margin-top: 3px;
  font: 800 10px/1 var(--font-body);
  letter-spacing: .08em;
  text-transform: uppercase;
  color: var(--color-on-surface-variant);
}

.bag-scan {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  margin-right: 4px;
  border: 2px solid var(--color-primary);
  border-radius: 10px 12px 10px 11px;
  background: #fff;
  color: var(--color-primary);
  box-shadow: 2px 2px 0 color-mix(in srgb, var(--color-primary) 70%, black);
  transform: rotate(-7deg);
}

.bag-scan .material-symbols-outlined {
  font-size: 24px;
  transform: rotate(7deg);
}

.bag-scan:active {
  background: var(--color-primary);
  color: var(--color-lime);
}

.bag-scan:focus-visible {
  outline: 2px solid var(--color-lime);
  outline-offset: 2px;
}
</style>
