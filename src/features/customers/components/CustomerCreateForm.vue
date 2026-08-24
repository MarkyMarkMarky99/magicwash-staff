<script setup lang="ts">
import FormInput from '@/shared/components/FormInput.vue'
import FormTextarea from '@/shared/components/FormTextarea.vue'

export type CustomerCreateFormData = {
  customerName: string
  phone: string
  address: string
  location: string
  registeredDate: string
  facebook: string
  lineId: string
  whatsapp: string
  email: string
}

const props = defineProps<{
  modelValue: CustomerCreateFormData
}>()

const emit = defineEmits<{
  'update:modelValue': [value: CustomerCreateFormData]
}>()

function updateField(field: keyof CustomerCreateFormData, value: string) {
  emit('update:modelValue', { ...props.modelValue, [field]: value })
}
</script>

<template>
  <div class="customer-create-form">
    <aside class="unavailable-note" role="status">
      <span class="material-symbols-outlined" aria-hidden="true">info</span>
      <div>
        <strong>ยังบันทึกลูกค้าใหม่ไม่ได้</strong>
        <p>หน้านี้ใช้กรอกและตรวจข้อมูลได้ แต่ระบบหลังบ้านสำหรับสร้างลูกค้ายังไม่พร้อมใช้งาน</p>
      </div>
    </aside>

    <fieldset class="form-section">
      <legend>ข้อมูลลูกค้า</legend>
      <FormInput
        id="customer-name"
        :model-value="modelValue.customerName"
        label="ชื่อลูกค้า *"
        placeholder="เช่น คุณสมใจ ใจดี"
        autocomplete="name"
        @update:model-value="updateField('customerName', $event)"
      />
      <FormInput
        id="customer-phone"
        :model-value="modelValue.phone"
        label="เบอร์โทรศัพท์ *"
        type="tel"
        placeholder="เช่น 0812345678"
        autocomplete="tel"
        @update:model-value="updateField('phone', $event)"
      />
      <FormTextarea
        id="customer-address"
        :model-value="modelValue.address"
        label="ที่อยู่"
        placeholder="บ้านเลขที่ ถนน แขวง/ตำบล เขต/อำเภอ จังหวัด"
        @update:model-value="updateField('address', $event)"
      />
      <FormInput
        id="customer-location"
        :model-value="modelValue.location"
        label="จุดรับ-ส่ง / พิกัด"
        placeholder="เช่น คอนโด A อาคาร 2"
        @update:model-value="updateField('location', $event)"
      />
      <FormInput
        id="registered-date"
        :model-value="modelValue.registeredDate"
        label="วันที่ลงทะเบียน"
        type="date"
        @update:model-value="updateField('registeredDate', $event)"
      />
    </fieldset>

    <fieldset class="form-section contact-section">
      <legend>ช่องทางติดต่อ</legend>
      <FormInput id="facebook" :model-value="modelValue.facebook" label="Facebook" placeholder="ชื่อโปรไฟล์หรือ URL" @update:model-value="updateField('facebook', $event)" />
      <FormInput id="line-id" :model-value="modelValue.lineId" label="LINE ID" placeholder="เช่น somjai.laundry" @update:model-value="updateField('lineId', $event)" />
      <FormInput id="whatsapp" :model-value="modelValue.whatsapp" label="WhatsApp" placeholder="เช่น +66812345678" @update:model-value="updateField('whatsapp', $event)" />
      <FormInput id="email" :model-value="modelValue.email" label="อีเมล" type="email" placeholder="name@example.com" autocomplete="email" @update:model-value="updateField('email', $event)" />
    </fieldset>

  </div>
</template>

<style scoped>
.customer-create-form { color:#073f38; font-family:'Noto Sans Thai',system-ui,sans-serif; padding-bottom:22px; }
.unavailable-note { display:flex; gap:10px; margin:0 0 22px; padding:13px 14px; color:#315952; border:1px solid #b7d6d0; border-left:4px solid #007a69; border-radius:10px; background:#edf7f5; }
.unavailable-note span { color:#007a69; font-size:20px; }
.unavailable-note strong { display:block; color:#073f38; font-size:13px; }
.unavailable-note p { margin:3px 0 0; font-size:12px; line-height:1.45; }
.form-section { min-width:0; margin:0 0 23px; padding:0; border:0; }
.form-section legend { display:flex; align-items:center; width:100%; margin:0 0 12px; padding:0; color:#00564b; font-size:12px; font-weight:700; letter-spacing:.03em; }
.form-section legend::after { height:1px; flex:1; margin-left:10px; background:#cae0dc; content:''; }
.form-section :deep(section) { margin-bottom:15px; }
.contact-section :deep(section) { margin-bottom:13px; }
@media (prefers-reduced-motion:reduce) { *,*::before,*::after { transition:none!important; } }
</style>
