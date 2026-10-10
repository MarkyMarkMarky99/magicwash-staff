<script setup lang="ts">
import { computed } from 'vue'
import CloseButton from '@/shared/components/CloseButton.vue'
import StickerFab from '@/shared/components/StickerFab.vue'
import WeightField from '@/shared/components/WeightField.vue'
import type { WashProgramDto } from '@/data/wash-programs/wash-programs.service'
import type { MachineDto } from '@/data/machines/machines.service'
import ConfirmOverlay from '@/shared/layouts/ConfirmOverlay.vue'
import type { WashOptions } from '../wash-options'
import { machineLabel } from '../machine-label'
import WashQueueWashOptionsForm from './WashQueueWashOptionsForm.vue'
import WashQueueMachineMenu from './WashQueueMachineMenu.vue'
import WashQueueMachinePicker from './WashQueueMachinePicker.vue'
import WashQueueNotice from './WashQueueNotice.vue'
import WashQueueTagWheel from './WashQueueTagWheel.vue'

// One screen: weigh, photograph, tag and choose the washer and program. Washers pick the machine from the
// Wash program header; dryers have no program and keep the capacity tiles.
const props = defineProps<{
  open: boolean
  mode: 'washer' | 'dryer'
  photoUrl: string
  uploading: boolean
  rawWeight: string
  weightError: string | null
  weightValid: boolean
  machines: readonly MachineDto[]
  machineId: string | null
  tagCode: string | null
  washOptions: WashOptions | null
  programs: readonly WashProgramDto[]
  productName: (id: string) => string
  error: string | null
  saving: boolean
  confirmDisabled: boolean
}>()
const emit = defineEmits<{
  close: []
  confirm: []
  photo: []
  weightInvalid: []
  'update:rawWeight': [value: string]
  'update:machineId': [machineId: string]
  'update:tagCode': [tagCode: string]
  'update:washOptions': [value: WashOptions]
}>()
const chosenLabel = computed(() => props.machineId ? machineLabel(props.machineId, props.machines) : null)
</script>

<template>
  <ConfirmOverlay :open="open" title="Book this basket?" description="Put the basket on the scale, enter its weight and take a photo that shows it on the scale." cancel-label="Discard" confirm-label="Book" :confirm-disabled="confirmDisabled" @close="emit('close')" @confirm="!confirmDisabled && emit('confirm')">
    <template #header-action><CloseButton class="absolute right-4 top-3 text-on-surface-variant" @click="emit('close')" /></template>
    <div class="wq-book-content">
      <div v-if="photoUrl" class="relative aspect-square overflow-hidden rounded-[18px] bg-surface-container-low">
        <img :src="photoUrl" alt="Basket on the scale preview" class="h-full w-full object-cover" />
        <WashQueueTagWheel :model-value="tagCode" :disabled="saving" @update:model-value="emit('update:tagCode', $event)" />
      </div>
      <div v-else class="wq-book-empty">
        <span class="wq-book-empty__icon"><span class="material-symbols-outlined fill" aria-hidden="true">{{ uploading ? 'cloud_upload' : 'photo_camera' }}</span></span>
        <p class="mt-3 font-body text-sm font-extrabold tracking-[-0.015em] text-on-surface">{{ uploading ? 'Uploading photo…' : 'No photo yet' }}</p>
        <p class="mt-1 font-body text-[13px] text-on-surface-variant">Weigh the basket, then tap Photo.</p>
      </div>
      <WeightField class="wq-book-weight" :model-value="rawWeight" input-id="wash-queue-weight" :error="weightError" @update:model-value="emit('update:rawWeight', $event)" @invalid="emit('weightInvalid')">
        <template #action>
          <StickerFab class="wq-book-photo mr-1 shrink-0 !h-[47px] !w-[47px] !rounded-[15px_18px_16px_17px]" :class="{ done: photoUrl && !uploading }" :label="photoUrl ? 'Retake' : 'Photo'" :aria-label="photoUrl ? 'Retake photo' : 'Take photo'" :saving="uploading" saving-label="Uploading" :disabled="!weightValid || saving" @click="emit('photo')">
            <span class="material-symbols-outlined text-[20px] leading-none" aria-hidden="true">{{ photoUrl ? 'flip_camera_ios' : 'photo_camera' }}</span>
          </StickerFab>
        </template>
      </WeightField>
      <WashQueueMachinePicker v-if="mode === 'dryer'" :machines="machines" :model-value="machineId" @update:model-value="emit('update:machineId', $event)" />
      <WashQueueWashOptionsForm v-else-if="washOptions !== null" :model-value="washOptions" :programs="programs" :product-name="productName" :machine="chosenLabel" @update:model-value="emit('update:washOptions', $event)">
        <template #action><WashQueueMachineMenu :machines="machines" :model-value="machineId" @update:model-value="emit('update:machineId', $event)" /></template>
      </WashQueueWashOptionsForm>
      <WashQueueNotice v-if="error" class="mb-3" tone="error" :message="error" />
    </div>
    <template #footer><footer class="flex flex-none gap-2.5 border-t border-outline-variant px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-3"><button type="button" class="h-[52px] flex-1 rounded-full border-2 border-primary bg-white font-headline font-bold text-primary" @click="emit('close')">Discard</button><button type="submit" class="h-[52px] flex-1 rounded-full bg-primary font-headline font-bold text-white disabled:opacity-35" :disabled="confirmDisabled">Book</button></footer></template>
  </ConfirmOverlay>
</template>

<style scoped>
:global([data-overlay-frame]:has(.wq-book-content)) {
  align-items: flex-end;
  padding: 0;
}

:global([data-overlay-panel]:has(.wq-book-content)) {
  height: calc(100% - 30px);
  max-width: 100% !important;
  border-radius: 28px 28px 0 0;
  outline: none;
}

:global([data-overlay-panel]:has(.wq-book-content) form) {
  flex: 1;
  background: var(--color-surface);
}

:global([data-overlay-panel]:has(.wq-book-content) form > header) {
  padding: 18px 20px 8px;
}

:global([data-overlay-panel]:has(.wq-book-content) h2) {
  font-size: 22px;
  font-weight: 800;
  line-height: 1.15;
}

:global([data-overlay-panel]:has(.wq-book-content) form > .no-scrollbar) {
  min-height: 0;
  flex: 1;
  padding: 4px 16px 18px;
}

/* Before the photo: a dashed frame with the bag-scan empty state in the middle. */
.wq-book-empty {
  display: flex;
  height: 200px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 0 24px;
  border: 2px dashed color-mix(in srgb, var(--color-primary) 40%, white);
  border-radius: 18px;
  text-align: center;
}

.wq-book-empty__icon {
  display: grid;
  width: 56px;
  height: 56px;
  place-items: center;
  border-radius: 18px;
  background: var(--color-secondary-container);
  color: var(--color-on-secondary-container);
  transform: rotate(-7deg);
}

.wq-book-empty__icon .material-symbols-outlined {
  font-size: 28px;
}

.fill {
  font-variation-settings: "FILL" 1;
}

.wq-book-weight {
  padding: 18px 0 18px;
}

/* Photo taken: the sticker turns dark, like a selected tile, and offers a retake. */
.wq-book-photo.done:not(:disabled) {
  background: var(--color-primary);
  color: var(--color-lime);
}

.wq-book-photo.done:not(:disabled) :deep(.sticker-label) {
  color: #fff;
}
</style>
