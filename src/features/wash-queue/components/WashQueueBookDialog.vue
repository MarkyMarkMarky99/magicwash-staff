<script setup lang="ts">
import type { MachineDto } from '@/data/machines/machines.service'
import ConfirmOverlay from '@/shared/layouts/ConfirmOverlay.vue'
import type { WashProductDto } from '@/data/wash-products/wash-products.service'
import type { WashOptions } from '../wash-options'
import WashQueueWashOptionsForm from './WashQueueWashOptionsForm.vue'
import { formatKg } from '../format-weights'
import WashQueueMachinePicker from './WashQueueMachinePicker.vue'
import WashQueueNotice from './WashQueueNotice.vue'
import WashQueueTagPicker from './WashQueueTagPicker.vue'

defineProps<{
  open: boolean
  photoUrl: string
  weight: number | null
  machines: readonly MachineDto[]
  machineId: string | null
  tagCode: string | null
  washOptions: WashOptions | null
  detergents: readonly WashProductDto[]
  softeners: readonly WashProductDto[]
  bleaches: readonly WashProductDto[]
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
}>()
</script>

<template>
  <ConfirmOverlay :open="open" title="Book this basket?" cancel-label="Discard" confirm-label="Book" :confirm-disabled="confirmDisabled" @close="emit('close')" @confirm="emit('confirm')">
    <img v-if="photoUrl" :src="photoUrl" alt="Basket on the scale preview" class="mb-3 h-40 w-full rounded-xl object-cover" />
    <div v-if="weight !== null" class="mb-3 flex items-center justify-between gap-3">
      <p class="font-headline text-lg font-bold text-primary">{{ formatKg(weight) }}</p>
      <button type="button" class="flex h-11 items-center justify-center rounded-full border border-outline-variant px-5 font-label text-sm text-on-surface-variant focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime disabled:opacity-50" :disabled="saving" @click="emit('reweigh')">Re-weigh</button>
    </div>
    <WashQueueMachinePicker :machines="machines" :model-value="machineId" @update:model-value="emit('update:machineId', $event)" />
    <WashQueueTagPicker :model-value="tagCode" @update:model-value="emit('update:tagCode', $event)" />
    <WashQueueWashOptionsForm v-if="washOptions !== null" :model-value="washOptions" :detergents="detergents" :softeners="softeners" :bleaches="bleaches" @update:model-value="emit('update:washOptions', $event)" />
    <WashQueueNotice v-if="error" class="mb-3" tone="error" :message="error" />
  </ConfirmOverlay>
</template>
