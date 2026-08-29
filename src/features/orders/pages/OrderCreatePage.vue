<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import FormInput from '@/shared/components/FormInput.vue'
import FormOptionGrid from '@/shared/components/FormOptionGrid.vue'
import FormTextarea from '@/shared/components/FormTextarea.vue'
import FormOverlay from '@/shared/layouts/FormOverlay.vue'
import OrderCustomerPicker from '@/features/orders/components/OrderCustomerPicker.vue'
import { useOrderStore } from '@/features/orders/stores/order.store'

defineOptions({ name: 'OrderCreatePage' })

const router = useRouter()
const orderStore = useOrderStore()
const { customers } = storeToRefs(orderStore)
const submitted = ref(false)
const form = reactive({ customerId: '', receivedDate: '', dueDate: '', serviceType: '', quantity: '', hangers: '', bags: '', note: '', orderName: '', orderDescription: '' })
const serviceOptions = [{ value: 'WSIR', label: 'WSIR', icon: 'local_laundry_service' }, { value: 'IRON', label: 'IRON', icon: 'iron' }, { value: 'DRCL', label: 'DRCL', icon: 'dry_cleaning' }, { value: 'WASH', label: 'WASH', icon: 'water_drop' }]
const invalid = computed(() => !form.customerId || !form.receivedDate || !form.dueDate || !form.serviceType)
const dateError = computed(() => submitted.value && (!form.receivedDate || !form.dueDate))

function resetForm() { Object.assign(form, { customerId: '', receivedDate: '', dueDate: '', serviceType: '', quantity: '', hangers: '', bags: '', note: '', orderName: '', orderDescription: '' }); submitted.value = false }
function close() { router.push({ name: 'order-list' }) }
function submit() { submitted.value = true }
onMounted(resetForm)
</script>

<template>
  <FormOverlay open title="สร้างออเดอร์" eyebrow="New laundry intake" helper-text="บันทึกข้อมูลรับผ้าให้ครบก่อนเพิ่มรายการสินค้าและรูปภาพ" submit-label="ตรวจสอบข้อมูล" @close="close" @submit="submit">
    <div class="space-y-5 pb-5"><div v-if="submitted && invalid" class="rounded-xl border border-error/20 bg-error-container/30 px-3 py-2 font-body text-sm text-on-error-container">กรุณาเลือกลูกค้า ระบุวันที่รับผ้า กำหนดส่ง และบริการ</div><div v-else-if="submitted" class="rounded-xl bg-secondary-container/40 px-3 py-2 font-body text-sm text-on-surface">ข้อมูลผ่านการตรวจสอบในต้นแบบแล้ว ยังไม่มีการส่งคำขอสร้างออเดอร์</div><OrderCustomerPicker v-model="form.customerId" :customers="customers"/><div class="grid grid-cols-2 gap-3"><FormInput id="order-received-date" v-model="form.receivedDate" label="วันที่รับผ้า *" type="date"/><FormInput id="order-due-date" v-model="form.dueDate" label="กำหนดส่ง *" type="date"/></div><p v-if="dateError" class="-mt-3 text-xs text-error">กรุณาระบุวันที่รับผ้าและกำหนดส่ง</p><FormOptionGrid v-model="form.serviceType" label="บริการ *" :options="serviceOptions"/><section class="rounded-xl border border-outline-variant/25 bg-surface-container-low p-3"><p class="mb-3 font-label text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">รายละเอียดรับผ้า</p><div class="grid grid-cols-3 gap-2"><FormInput id="order-quantity" v-model="form.quantity" label="จำนวน" type="number" placeholder="0"/><FormInput id="order-hangers" v-model="form.hangers" label="ไม้แขวน" type="number" placeholder="0"/><FormInput id="order-bags" v-model="form.bags" label="ถุง" type="number" placeholder="0"/></div></section><FormInput id="order-name" v-model="form.orderName" label="ชื่อออเดอร์" placeholder="เช่น ผ้ารับวันที่ 30 ส.ค."/><FormTextarea id="order-description" v-model="form.orderDescription" label="รายละเอียดออเดอร์" placeholder="ระบุรายละเอียดเพิ่มเติม เช่น ผ้าไหมและผ้าที่ต้องการดูแลเป็นพิเศษ"/><FormTextarea id="order-note" v-model="form.note" label="หมายเหตุ" placeholder="ข้อสังเกตสำหรับทีมซักรีด"/></div>
  </FormOverlay>
</template>
