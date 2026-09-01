<script setup lang="ts">
import { ref, watch } from 'vue'
import BaseOverlay from '@/shared/layouts/BaseOverlay.vue'
import FormInput from '@/shared/components/FormInput.vue'
import { MAX_ORDER_IMAGE_WEIGHT_KG, parseOrderImageWeight } from '@/features/orders/composables/use-order-overlay-route'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{
  submit: [weight: number]
  close: []
}>()

const rawWeight = ref('')
const weightError = ref<string | null>(null)

function submit(): void {
  const weight = parseOrderImageWeight(rawWeight.value)
  if (weight === null) {
    weightError.value = `ใส่น้ำหนักเป็นตัวเลขมากกว่า 0 และไม่เกิน ${MAX_ORDER_IMAGE_WEIGHT_KG} กก.`
    return
  }
  weightError.value = null
  emit('submit', weight)
}

watch(() => props.open, (isOpen) => {
  if (isOpen) {
    rawWeight.value = ''
    weightError.value = null
  }
})
</script>

<template>
  <BaseOverlay :open="open" aria-label="ระบุน้ำหนัก" @close="emit('close')">
    <div class="p-5">
      <h2 class="font-headline text-2xl font-bold text-primary">ระบุน้ำหนัก</h2>
      <p class="mt-2 font-body text-sm text-on-surface-variant">ใส่น้ำหนักก่อนถ่ายรูป น้ำหนักนี้จะใช้กับทุกรูปในครั้งนี้</p>
      <div class="mt-5">
        <FormInput id="order-image-weight" v-model="rawWeight" label="น้ำหนัก (กก.)" type="number" placeholder="เช่น 20.5" min="0" max="200" />
      </div>
      <p v-if="weightError" class="mt-2 font-body text-sm text-error">{{ weightError }}</p>
      <div class="mt-6 flex justify-end gap-2">
        <button type="button" class="rounded-full border border-outline-variant px-4 py-2 font-body text-sm text-on-surface" @click="emit('close')">ยกเลิก</button>
        <button type="button" class="rounded-full bg-primary px-4 py-2 font-body text-sm font-bold text-on-primary" @click="submit">เปิดกล้อง</button>
      </div>
    </div>
  </BaseOverlay>
</template>
