<script setup lang="ts">
import FormInput from '@/shared/components/FormInput.vue'
import FormTextarea from '@/shared/components/FormTextarea.vue'
import FormToggleInput from '@/shared/components/FormToggleInput.vue'
import { currentActor } from '@/shared/config/actor'
import { formatPhoneDisplay, nextPhoneDigits } from '../utils/phone-format'
import SocialLogo from './SocialLogo.vue'

export type CustomerCreateFormData = {
  customerName: string
  phone: string
  address: string
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

function onPhoneInput(value: string) {
  const digits = nextPhoneDigits(props.modelValue.phone, value)
  const input = document.getElementById('customer-phone')
  if (input instanceof HTMLInputElement) input.value = formatPhoneDisplay(digits)
  updateField('phone', digits)
}
</script>

<template>
  <div class="customer-create-form">
    <fieldset class="form-section" :disabled="disabled">
      <FormInput
        id="customer-name"
        :model-value="modelValue.customerName"
        label="Customer name *"
        placeholder="e.g. Somjai Jaidee"
        autocomplete="name"
        @update:model-value="updateField('customerName', $event)"
      />
      <FormInput
        id="customer-phone"
        :model-value="formatPhoneDisplay(modelValue.phone)"
        label="Phone *"
        type="tel"
        inputmode="numeric"
        placeholder="081-234-5678"
        autocomplete="tel"
        :aria-invalid="Boolean(phoneError)"
        :aria-describedby="phoneError ? 'customer-phone-error' : undefined"
        @update:model-value="onPhoneInput"
      />
      <p v-if="phoneError" id="customer-phone-error" class="field-error" role="alert">{{ phoneError }}</p>
      <FormInput id="email" :model-value="modelValue.email" label="Email" type="email" placeholder="name@example.com" autocomplete="email" @update:model-value="updateField('email', $event)" />
      <FormTextarea
        id="customer-address"
        :model-value="modelValue.address"
        label="Address"
        placeholder="House no., street, subdistrict, district, province"
        @update:model-value="updateField('address', $event)"
      />
      <FormToggleInput id="facebook" :model-value="modelValue.facebook" label="Facebook" description="Profile name or link" input-label="Facebook profile" placeholder="Profile name or URL" @update:model-value="updateField('facebook', $event)">
        <template #icon><SocialLogo brand="facebook" /></template>
      </FormToggleInput>
      <FormToggleInput id="line-id" :model-value="modelValue.lineId" label="LINE" description="Customer's LINE ID" input-label="LINE ID" placeholder="e.g. somjai.laundry" @update:model-value="updateField('lineId', $event)">
        <template #icon><SocialLogo brand="line" /></template>
      </FormToggleInput>
      <FormToggleInput id="whatsapp" :model-value="modelValue.whatsapp" label="WhatsApp" description="Number with country code" input-label="WhatsApp number" placeholder="e.g. +66812345678" @update:model-value="updateField('whatsapp', $event)">
        <template #icon><SocialLogo brand="whatsapp" /></template>
      </FormToggleInput>
    </fieldset>

  </div>
</template>

<style scoped>
.customer-create-form { color:var(--color-on-surface); font-family:'Noto Sans Thai',system-ui,sans-serif; padding-bottom:22px; }
.field-error { margin:-8px 0 15px; color:var(--color-error); font-size:12px; }
.form-section { min-width:0; margin:0 0 23px; padding:0; border:0; }
.form-section :deep(section) { margin-bottom:15px; }
.form-section :deep(section.pb-4) { padding-bottom:0; }
@media (prefers-reduced-motion:reduce) { *,*::before,*::after { transition:none!important; } }
</style>
