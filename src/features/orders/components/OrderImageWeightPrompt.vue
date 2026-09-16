<script setup lang="ts">
import { ref, watch } from 'vue'
import ConfirmOverlay from '@/shared/layouts/ConfirmOverlay.vue'
import FormInput from '@/shared/components/FormInput.vue'
import { MAX_ORDER_IMAGE_WEIGHT_KG, parseOrderImageWeight } from '@/features/orders/composables/use-order-overlay-route'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{
  submit: [weight: number]
  close: []
}>()

const rawWeight = ref('')
const weightError = ref<string | null>(null)
const suppressClose = ref(false)

function showWeightError(): void {
  weightError.value = `Enter a weight greater than 0 and up to ${MAX_ORDER_IMAGE_WEIGHT_KG} kg, with at most 1 decimal place`
}

function handleInvalid(event: Event): void {
  event.preventDefault()
  showWeightError()
}

function submit(): void {
  const weight = parseOrderImageWeight(rawWeight.value)
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
    title="Enter weight"
    description="Enter the weight before taking photos. This weight will apply to all photos this time."
    confirm-label="Open camera"
    @close="handleClose"
    @confirm="submit"
  >
      <div class="pt-2">
        <FormInput id="order-image-weight" v-model="rawWeight" label="Weight (kg)" type="number" placeholder="e.g. 20.5" min="0.1" max="200" step="0.1" inputmode="decimal" :aria-describedby="weightError ? 'order-image-weight-error' : undefined" :aria-invalid="Boolean(weightError)" @invalid="handleInvalid" />
      </div>
      <p v-if="weightError" id="order-image-weight-error" class="mt-2 font-body text-sm text-error">{{ weightError }}</p>
  </ConfirmOverlay>
</template>
