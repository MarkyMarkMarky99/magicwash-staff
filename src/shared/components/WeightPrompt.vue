<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import ConfirmOverlay from '@/shared/layouts/ConfirmOverlay.vue'
import CloseButton from '@/shared/components/CloseButton.vue'
import StickerFab from '@/shared/components/StickerFab.vue'
import WeightField from '@/shared/components/WeightField.vue'
import { MAX_BAG_ITEM_COUNT, MAX_ORDER_IMAGE_WEIGHT_KG, parseItemCount, parseWeightKg } from '@shared/utils/item-quantity'

const props = withDefaults(defineProps<{
  open: boolean
  title?: string
  description?: string
  confirmLabel?: string
  inputId?: string
  withCount?: boolean
}>(), {
  title: 'Enter weight',
  description: '',
  confirmLabel: 'Photo',
  inputId: 'weight-prompt-input',
  withCount: false,
})
const emit = defineEmits<{
  submit: [weight: number, itemCount: number | null]
  close: []
}>()

const rawWeight = ref('')
const rawCount = ref('')
const weightError = ref<string | null>(null)
const countError = ref<string | null>(null)
const suppressClose = ref(false)
const countValid = computed(() => !props.withCount || rawCount.value.trim() === '' || parseItemCount(rawCount.value) !== null)
const valid = computed(() => parseWeightKg(rawWeight.value) !== null && countValid.value)

function showWeightError(): void {
  weightError.value = `Enter a weight greater than 0 and up to ${MAX_ORDER_IMAGE_WEIGHT_KG} kg, with at most 1 decimal place`
}

function showCountError(): void {
  countError.value = `Enter a whole number from 1 to ${MAX_BAG_ITEM_COUNT}, or leave it blank`
}

function submit(): void {
  const weight = parseWeightKg(rawWeight.value)
  if (weight === null) {
    showWeightError()
    return
  }
  weightError.value = null
  if (!countValid.value) {
    showCountError()
    return
  }
  countError.value = null
  suppressClose.value = true
  emit('submit', weight, props.withCount ? parseItemCount(rawCount.value) : null)
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
    rawCount.value = ''
    weightError.value = null
    countError.value = null
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
        <StickerFab size="field" class="mr-1 shrink-0" :label="confirmLabel" aria-label="Take photo" :disabled="!valid" @click="submit">
          <span class="material-symbols-outlined text-[20px] leading-none" aria-hidden="true">photo_camera</span>
        </StickerFab>
      </template>
    </WeightField>
    <WeightField
      v-if="withCount"
      v-model="rawCount"
      class="mt-2"
      :input-id="`${inputId}-count`"
      :error="countError"
      label="Count (optional)"
      unit="pcs"
      placeholder="Leave blank if unknown"
      min="1"
      :max="String(MAX_BAG_ITEM_COUNT)"
      step="1"
      inputmode="numeric"
      @invalid="showCountError"
    >
      <template #action>
        <span class="mr-1 w-[47px] shrink-0" aria-hidden="true" />
      </template>
    </WeightField>
    <template #footer>
      <div class="flex-none pb-5" aria-hidden="true" />
    </template>
  </ConfirmOverlay>
</template>
