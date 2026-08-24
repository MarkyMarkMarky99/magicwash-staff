<script setup lang="ts">
import { reactive } from 'vue'
import { useRouter } from 'vue-router'
import FormOverlay from '@/shared/layouts/FormOverlay.vue'
import CustomerCreateForm from '../components/CustomerCreateForm.vue'
import type { CustomerCreateFormData } from '../components/CustomerCreateForm.vue'

defineOptions({ name: 'CustomerCreatePage' })

const router = useRouter()

const customer = reactive<CustomerCreateFormData>({
  customerName: '',
  phone: '',
  address: '',
  location: '',
  registeredDate: '',
  facebook: '',
  lineId: '',
  whatsapp: '',
  email: '',
  customerType: '',
  source: '',
})

function returnToCustomerList() {
  void router.replace({ name: 'customer-list' })
}

function updateCustomer(value: CustomerCreateFormData) {
  Object.assign(customer, value)
}
</script>

<template>
  <FormOverlay
    :open="true"
    eyebrow="CUSTOMERS / NEW RECORD"
    title="เพิ่มลูกค้าใหม่"
    helper-text="กรอกข้อมูลลูกค้าให้พร้อมสำหรับการเปิดใช้งานเมื่อระบบบันทึกพร้อม"
    submit-label="บันทึกข้อมูลลูกค้า"
    :is-submit-disabled="true"
    :close-on-backdrop="false"
    @close="returnToCustomerList"
  >
    <CustomerCreateForm :model-value="customer" @update:model-value="updateCustomer" @cancel="returnToCustomerList" />
  </FormOverlay>
</template>
