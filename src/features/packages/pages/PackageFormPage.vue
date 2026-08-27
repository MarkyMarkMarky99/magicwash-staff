<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import FormInput from '@/shared/components/FormInput.vue'
import FormTextarea from '@/shared/components/FormTextarea.vue'
import FormSwitch from '@/shared/components/FormSwitch.vue'
import FormOverlay from '@/shared/layouts/FormOverlay.vue'
import type { PackageDto } from '../services/package.service'
import { usePackageStore } from '../stores/package.store'

defineOptions({ name: 'PackageFormPage' })
const props = defineProps<{ packageCode?: string }>()
const router = useRouter()
const packageStore = usePackageStore()
const { items, error: storeError } = storeToRefs(packageStore)
const isEdit = computed(() => Boolean(props.packageCode))
const form = reactive({ packageCode: '', name: '', eligibleService: '', includedCredit: '', price: '', notes: '' })
const isActive = ref(true)
const actorInput = ref('')
const formError = ref<string | null>(null)
const initializing = ref(true)
const submitting = ref(false)
const valid = computed(() => (isEdit.value || form.packageCode.trim() !== '') && form.name.trim() !== '' && form.eligibleService.trim() !== '' && form.includedCredit !== '' && Number.isInteger(Number(form.includedCredit)) && Number(form.includedCredit) >= 0 && form.price !== '' && Number.isFinite(Number(form.price)) && Number(form.price) >= 0 && actorInput.value.trim() !== '')

function fillForm(source: PackageDto) {
  form.packageCode = source.packageCode
  form.name = source.name
  form.eligibleService = source.eligibleService
  form.includedCredit = String(source.includedCredit)
  form.price = String(source.price)
  form.notes = source.notes ?? ''
  isActive.value = source.deletedAt === null
}

function businessFields() {
  return { name: form.name.trim(), eligibleService: form.eligibleService.trim(), includedCredit: Number(form.includedCredit), price: Number(form.price), notes: form.notes.trim() === '' ? null : form.notes.trim() }
}

function returnToList() { void router.push('/packages') }
async function submitForm() {
  formError.value = null
  submitting.value = true
  try {
    if (isEdit.value && props.packageCode) await packageStore.update(props.packageCode, { ...businessFields(), active: isActive.value, updatedBy: actorInput.value.trim() })
    else await packageStore.create({ packageCode: form.packageCode.trim(), ...businessFields(), createdBy: actorInput.value.trim() })
    await router.push('/packages')
  } catch (reason) {
    formError.value = reason instanceof Error ? reason.message : 'Unable to save package'
  } finally { submitting.value = false }
}

onMounted(async () => {
  await packageStore.load()
  if (props.packageCode) {
    const source = items.value.find((item) => item.packageCode === props.packageCode)
    if (source) fillForm(source)
    else formError.value = storeError.value ?? 'ไม่พบแพ็กเกจนี้'
  }
  initializing.value = false
})
</script>

<template>
  <FormOverlay :open="true" :title="isEdit ? 'แก้ไขแพ็กเกจ' : 'เพิ่มแพ็กเกจ'" submit-label="บันทึกแพ็กเกจ" :is-submitting="submitting" :is-submit-disabled="initializing || !valid" :close-on-backdrop="false" @close="returnToList" @submit="submitForm">
    <div class="space-y-4 pb-4">
      <FormInput v-if="!isEdit" id="package-code" v-model="form.packageCode" label="รหัสแพ็กเกจ *" />
      <FormInput id="package-name" v-model="form.name" label="ชื่อแพ็กเกจ *" />
      <FormInput id="package-eligible-service" v-model="form.eligibleService" label="บริการที่ใช้ได้ *" />
      <FormInput id="package-included-credit" v-model="form.includedCredit" type="number" label="จำนวนเครดิต *" min="0" />
      <FormInput id="package-price" v-model="form.price" type="number" label="ราคา *" min="0" />
      <FormTextarea id="package-notes" v-model="form.notes" label="หมายเหตุ" />
      <FormSwitch v-if="isEdit" v-model="isActive" label="เปิดขายแพ็กเกจนี้" description="ปิดสวิตช์เพื่อเลิกขาย — ไม่มีการลบข้อมูล" />
      <FormInput id="package-actor" v-model="actorInput" label="ผู้บันทึก *" />
      <p v-if="formError" class="rounded-xl bg-error-container/30 p-3 font-body text-sm text-on-error-container">{{ formError }}</p>
    </div>
  </FormOverlay>
</template>
