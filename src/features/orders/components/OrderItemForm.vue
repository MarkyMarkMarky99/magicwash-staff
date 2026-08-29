<script setup lang="ts">
import { reactive, ref } from 'vue'
import FormInput from '@/shared/components/FormInput.vue'
import FormOptionGrid from '@/shared/components/FormOptionGrid.vue'
import FormTextarea from '@/shared/components/FormTextarea.vue'
import FormOverlay from '@/shared/layouts/FormOverlay.vue'

defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()
const submitted = ref(false)
const form = reactive({ description: '', quantity: '', price: '', category: '', serviceType: '', specialInstructions: '' })
const serviceOptions = [{ value: 'WSIR', label: 'WSIR', icon: 'local_laundry_service' }, { value: 'IRON', label: 'IRON', icon: 'iron' }, { value: 'DRCL', label: 'DRCL', icon: 'dry_cleaning' }, { value: 'WASH', label: 'WASH', icon: 'water_drop' }]
const categoryOptions = [{ value: 'Tops', label: 'Tops' }, { value: 'Bottoms', label: 'Bottoms' }, { value: 'Home Textile', label: 'Home Textile' }, { value: 'Others', label: 'Others' }]
function submit() { submitted.value = true }
</script>

<template>
  <FormOverlay :open="open" title="เพิ่มรายการสินค้า" eyebrow="Order item" helper-text="บันทึกแบบต้นแบบ — จะเชื่อมต่อเมื่อมี API สำหรับรายการสินค้า" submit-label="ตรวจสอบรายการ" :is-submit-disabled="!form.quantity" @close="emit('close')" @submit="submit">
    <div class="space-y-5 pb-5"><p v-if="submitted" class="rounded-xl bg-secondary-container/40 px-3 py-2 text-sm text-on-surface">ข้อมูลผ่านการตรวจสอบในหน้านี้แล้ว ยังไม่มีการบันทึกไปยังระบบ</p><FormTextarea id="order-item-description" v-model="form.description" label="รายละเอียดสินค้า" placeholder="เช่น เสื้อเชิ้ตสีขาว 2 ตัว"/><FormInput id="order-item-quantity" v-model="form.quantity" label="จำนวน *" type="number" placeholder="0"/><FormInput id="order-item-price" v-model="form.price" label="ราคา" type="number" placeholder="เว้นว่างได้"/><FormOptionGrid v-model="form.category" label="หมวดหมู่" :options="categoryOptions" variant="compact"/><FormOptionGrid v-model="form.serviceType" label="บริการ" :options="serviceOptions"/><FormTextarea id="order-item-instructions" v-model="form.specialInstructions" label="คำแนะนำเพิ่มเติม" placeholder="ระบุข้อควรระวังได้"/></div>
  </FormOverlay>
</template>
