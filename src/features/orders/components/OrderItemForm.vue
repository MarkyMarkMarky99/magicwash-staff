<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import type { z } from 'zod'
import { orderItemCreateSchema } from '@contracts/order-items/order-item-api.schema'
import FormInput from '@/shared/components/FormInput.vue'
import FormOptionGrid from '@/shared/components/FormOptionGrid.vue'
import FormTextarea from '@/shared/components/FormTextarea.vue'
import FormOverlay from '@/shared/layouts/FormOverlay.vue'

const itemPayloadSchema = orderItemCreateSchema.omit({ orderId: true, createdBy: true })
const props = defineProps<{ open: boolean; isSubmitting: boolean; error: string | null }>()
const emit = defineEmits<{ close: []; submit: [payload: z.infer<typeof itemPayloadSchema>] }>()
const submitted = ref(false)
const form = reactive({ description: '', quantity: '', price: '', category: '', specialInstructions: '' })
const categoryOptions = [{ value: 'Tops', label: 'Tops' }, { value: 'Bottoms', label: 'Bottoms' }, { value: 'Home Textile', label: 'Home Textile' }, { value: 'Others', label: 'Others' }]
const canSubmit = computed(() => Number.isFinite(Number(form.quantity)) && Number(form.quantity) > 0)

function submit() {
  submitted.value = true
  if (!canSubmit.value) return
  emit('submit', itemPayloadSchema.parse({
    itemId: null,
    description: form.description.trim() || null,
    quantity: Number(form.quantity),
    price: form.price === '' ? null : Number(form.price),
    category: form.category || null,
    specialInstructions: form.specialInstructions.trim() || null,
  }))
}
</script>

<template>
  <FormOverlay :open="props.open" title="เพิ่มรายการสินค้า" eyebrow="Order item" helper-text="บันทึกแบบต้นแบบ — จะเชื่อมต่อเมื่อมี API สำหรับรายการสินค้า" submit-label="ตรวจสอบรายการ" :is-submitting="props.isSubmitting" :is-submit-disabled="!canSubmit" @close="emit('close')" @submit="submit">
    <div class="space-y-5 pb-5"><p v-if="submitted && !canSubmit" class="rounded-xl border border-error/20 bg-error-container/30 px-3 py-2 text-sm text-on-error-container">กรุณาระบุจำนวนที่มากกว่า 0</p><p v-if="props.error" class="rounded-xl border border-error/20 bg-error-container/30 px-3 py-2 text-sm text-on-error-container">{{ props.error }}</p><FormTextarea id="order-item-description" v-model="form.description" label="รายละเอียดสินค้า" placeholder="เช่น เสื้อเชิ้ตสีขาว 2 ตัว"/><FormInput id="order-item-quantity" v-model="form.quantity" label="จำนวน *" type="number" placeholder="0"/><FormInput id="order-item-price" v-model="form.price" label="ราคา" type="number" placeholder="เว้นว่างได้"/><FormOptionGrid v-model="form.category" label="หมวดหมู่" :options="categoryOptions" variant="compact"/><FormTextarea id="order-item-instructions" v-model="form.specialInstructions" label="คำแนะนำเพิ่มเติม" placeholder="ระบุข้อควรระวังได้"/></div>
  </FormOverlay>
</template>
