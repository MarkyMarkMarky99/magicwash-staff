<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import ConfirmOverlay from '@/shared/layouts/ConfirmOverlay.vue'
import CloseButton from '@/shared/components/CloseButton.vue'
import StickerFab from '@/shared/components/StickerFab.vue'
import WeightField from '@/shared/components/WeightField.vue'
import { MAX_ORDER_IMAGE_WEIGHT_KG, parseWeightKg } from '@shared/utils/item-quantity'

const props = withDefaults(defineProps<{
  open: boolean
  title?: string
  description?: string
  confirmLabel?: string
  inputId?: string
}>(), {
  title: 'Enter weight',
  description: '',
  confirmLabel: 'Photo',
  inputId: 'weight-prompt-input',
})
const emit = defineEmits<{
  submit: [weight: number]
  close: []
}>()

const rawWeight = ref('')
const weightError = ref<string | null>(null)
const suppressClose = ref(false)
const valid = computed(() => parseWeightKg(rawWeight.value) !== null)

function showWeightError(): void {
  weightError.value = `Enter a weight greater than 0 and up to ${MAX_ORDER_IMAGE_WEIGHT_KG} kg, with at most 1 decimal place`
}

function submit(): void {
  const weight = parseWeightKg(rawWeight.value)
  if (weight === null) {
    showWeightError()
    return
  }
  weightError.value = null
  suppressClose.value = true
  emit('submit', weight)
}

function handleClose(): void {
  if (suppressClose.value && !props.open) {
    suppressClose.value = false
    return
  }
  suppressClose.value = false
  emit('close')
}

watch(() => props.open, (isOpen) => {
  if (isOpen) {
    rawWeight.value = ''
    weightError.value = null
    suppressClose.value = false
  }
})
</script>

<template>
  <ConfirmOverlay
    :open="open"
    :title="title"
    :description="description"
    :confirm-label="confirmLabel"
    @close="handleClose"
    @confirm="submit"
  >
    <template #header-action>
      <CloseButton class="absolute right-3 top-3 text-on-surface-variant" @click="handleClose" />
    </template>
    <WeightField v-model="rawWeight" :input-id="inputId" :error="weightError" @invalid="showWeightError">
      <template #action>
        <StickerFab class="mr-1 shrink-0 !h-[47px] !w-[47px] !rounded-[15px_18px_16px_17px]" :label="confirmLabel" aria-label="Take photo" :disabled="!valid" @click="submit">
          <span class="material-symbols-outlined text-[20px] leading-none" aria-hidden="true">photo_camera</span>
        </StickerFab>
      </template>
    </WeightField>
    <template #footer>
      <div class="flex-none pb-5" aria-hidden="true" />
    </template>
  </ConfirmOverlay>
</template>
