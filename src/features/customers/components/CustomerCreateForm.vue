<script setup lang="ts">
import FormInput from '@/shared/components/FormInput.vue'
import FormTextarea from '@/shared/components/FormTextarea.vue'
import { currentActor } from '@/shared/config/actor'

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
  updatedBy: string
}

const props = defineProps<{
  modelValue: CustomerCreateFormData
  phoneError?: string | null
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: CustomerCreateFormData]
}>()

function updateField(field: keyof CustomerCreateFormData, value: string) {
  emit('update:modelValue', { ...props.modelValue, [field]: value, updatedBy: currentActor() })
}
</script>

<template>
  <div class="customer-create-form">
    <fieldset class="form-section" :disabled="disabled">
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
        :aria-invalid="Boolean(phoneError)"
        :aria-describedby="phoneError ? 'customer-phone-error' : undefined"
        @update:model-value="updateField('phone', $event)"
      />
      <p v-if="phoneError" id="customer-phone-error" class="field-error" role="alert">{{ phoneError }}</p>
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

    <fieldset class="form-section contact-section" :disabled="disabled">
      <legend>ช่องทางติดต่อ</legend>
      <FormInput id="facebook" :model-value="modelValue.facebook" label="Facebook" placeholder="ชื่อโปรไฟล์หรือ URL" @update:model-value="updateField('facebook', $event)" />
      <FormInput id="line-id" :model-value="modelValue.lineId" label="LINE ID" placeholder="เช่น somjai.laundry" @update:model-value="updateField('lineId', $event)" />
      <FormInput id="whatsapp" :model-value="modelValue.whatsapp" label="WhatsApp" placeholder="เช่น +66812345678" @update:model-value="updateField('whatsapp', $event)" />
      <FormInput id="email" :model-value="modelValue.email" label="อีเมล" type="email" placeholder="name@example.com" autocomplete="email" @update:model-value="updateField('email', $event)" />
    </fieldset>

  </div>
</template>

<style scoped>
.customer-create-form { color:var(--color-on-surface); font-family:'Noto Sans Thai',system-ui,sans-serif; padding-bottom:22px; }
.field-error { margin:-8px 0 15px; color:var(--color-error); font-size:12px; }
.form-section { min-width:0; margin:0 0 23px; padding:0; border:0; }
.form-section legend { display:flex; align-items:center; width:100%; margin:0 0 12px; padding:0; color:var(--color-primary); font-size:12px; font-weight:700; letter-spacing:.03em; }
.form-section legend::after { height:1px; flex:1; margin-left:10px; background:var(--color-outline-variant); content:''; }
.form-section :deep(section) { margin-bottom:15px; }
.contact-section :deep(section) { margin-bottom:13px; }
@media (prefers-reduced-motion:reduce) { *,*::before,*::after { transition:none!important; } }
</style>
