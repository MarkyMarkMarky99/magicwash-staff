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

function submit(): void {
  const weight = parseOrderImageWeight(rawWeight.value)
  if (weight === null) {
    weightError.value = `ใส่น้ำหนักเป็นตัวเลขมากกว่า 0 และไม่เกิน ${MAX_ORDER_IMAGE_WEIGHT_KG} กก.`
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
    title="ระบุน้ำหนัก"
    description="ใส่น้ำหนักก่อนถ่ายรูป น้ำหนักนี้จะใช้กับทุกรูปในครั้งนี้"
    confirm-label="เปิดกล้อง"
    @close="handleClose"
    @confirm="submit"
  >
      <div class="pt-2">
        <FormInput id="order-image-weight" v-model="rawWeight" label="น้ำหนัก (กก.)" type="number" placeholder="เช่น 20.5" min="0" max="200" />
      </div>
      <p v-if="weightError" class="mt-2 font-body text-sm text-error">{{ weightError }}</p>
  </ConfirmOverlay>
</template>
