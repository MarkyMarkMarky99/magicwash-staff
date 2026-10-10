<script setup lang="ts">
import { ref, watch } from 'vue'
import CloseButton from '@/shared/components/CloseButton.vue'
import type { WashProgramDto } from '@/data/wash-programs/wash-programs.service'
import type { MachineDto } from '@/data/machines/machines.service'
import ConfirmOverlay from '@/shared/layouts/ConfirmOverlay.vue'
import type { WashProductDto } from '@/data/wash-products/wash-products.service'
import type { WashOptions } from '../wash-options'
import WashQueueWashOptionsForm from './WashQueueWashOptionsForm.vue'
import { formatKgFigure } from '../format-weights'
import WashQueueMachinePicker from './WashQueueMachinePicker.vue'
import WashQueueNotice from './WashQueueNotice.vue'
import WashQueueTagPicker from './WashQueueTagPicker.vue'

const props = defineProps<{
  open: boolean
  photoUrl: string
  weight: number | null
  machines: readonly MachineDto[]
  machineId: string | null
  tagCode: string | null
  washOptions: WashOptions | null
  programs: readonly WashProgramDto[]
  products: readonly WashProductDto[]
  productName: (id: string) => string
  error: string | null
  saving: boolean
  confirmDisabled: boolean
}>()
const emit = defineEmits<{
  close: []
  confirm: []
  reweigh: []
  'update:machineId': [machineId: string]
  'update:tagCode': [tagCode: string]
  'update:washOptions': [value: WashOptions]
  'update:stepsValid': [valid: boolean]
}>()
const stepsValid = ref(true)
watch(() => props.open, () => { stepsValid.value = true; emit('update:stepsValid', true) })
watch(() => props.washOptions, (value) => { if (value === null) { stepsValid.value = true; emit('update:stepsValid', true) } })
function validity(valid: boolean): void { stepsValid.value = valid; emit('update:stepsValid', valid) }
</script>

<template>
  <ConfirmOverlay :open="open" title="Book this basket?" cancel-label="Discard" confirm-label="Book" :confirm-disabled="confirmDisabled || !stepsValid || (washOptions !== null && !washOptions.steps.length)" @close="emit('close')" @confirm="!confirmDisabled && stepsValid && (washOptions === null || washOptions.steps.length > 0) && emit('confirm')">
    <template #header-action><CloseButton class="absolute right-4 top-3 text-on-surface-variant" @click="emit('close')" /></template>
    <div class="wq-book-content">
      <div class="relative mb-4 h-[150px] overflow-hidden rounded-[18px] bg-surface-container-low">
        <img v-if="photoUrl" :src="photoUrl" alt="Basket on the scale preview" class="h-full w-full object-cover" />
        <div v-if="weight !== null" class="weight-badge absolute bottom-2.5 left-2.5"><b>{{ formatKgFigure(weight) }}</b><span class="weight-unit">kg</span></div>
        <button type="button" aria-label="Retake photo and re-weigh" class="absolute right-1 top-1 grid h-11 w-11 place-items-center text-white drop-shadow-md disabled:opacity-50" :disabled="saving" @click="emit('reweigh')"><span class="material-symbols-outlined text-[28px]" aria-hidden="true">photo_camera</span></button>
      </div>
      <WashQueueMachinePicker :machines="machines" :model-value="machineId" @update:model-value="emit('update:machineId', $event)" />
      <WashQueueTagPicker :model-value="tagCode" @update:model-value="emit('update:tagCode', $event)" />
      <WashQueueWashOptionsForm v-if="washOptions !== null" :model-value="washOptions" :programs="programs" :products="products" :product-name="productName" @update:valid="validity" @update:model-value="emit('update:washOptions', $event)" />
      <WashQueueNotice v-if="error" class="mb-3" tone="error" :message="error" />
    </div>
    <template #footer><footer class="flex flex-none gap-2.5 border-t border-outline-variant px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-3"><button type="button" class="h-[52px] flex-1 rounded-full border-2 border-primary bg-white font-headline font-bold text-primary" @click="emit('close')">Discard</button><button type="submit" class="h-[52px] flex-1 rounded-full bg-primary font-headline font-bold text-white disabled:opacity-35" :disabled="confirmDisabled || !stepsValid || (washOptions !== null && !washOptions.steps.length)">Book</button></footer></template>
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

.weight-badge {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 10px 6px 12px;
  background: white;
  border: 2px solid var(--color-primary);
  border-radius: 11px 15px 12px 14px;
  box-shadow: 4px 4px 0 color-mix(in srgb,var(--color-primary) 70%,black);
}

.weight-badge b {
  font: 800 30px/1 var(--font-headline);
  color: var(--color-primary);
  font-variant-numeric: tabular-nums;
}

.weight-unit {
  display: grid;
  place-items: center;
  min-width: 34px;
  height: 26px;
  border: 2px solid var(--color-primary);
  border-radius: 10px 12px 10px 11px;
  background: white;
  color: var(--color-primary);
  box-shadow: 2px 2px 0 color-mix(in srgb,var(--color-primary) 70%,black);
  transform: rotate(-7deg);
  font: 800 12px/1 var(--font-headline);
}
</style>
