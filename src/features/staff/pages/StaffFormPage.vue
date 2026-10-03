<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import { registerStaffBodySchema, updateStaffBodySchema } from '@contracts/staff/staff-api.schema'
import { ApiError } from '@/shared/api/api-client'
import FormInput from '@/shared/components/FormInput.vue'
import FormOptionGrid from '@/shared/components/FormOptionGrid.vue'
import FormSwitch from '@/shared/components/FormSwitch.vue'
import FormTextarea from '@/shared/components/FormTextarea.vue'
import FormOverlay from '@/shared/layouts/FormOverlay.vue'
import { useCloseRoute } from '@/shared/navigation/use-close-route'
import { getStaff, registerStaff, updateStaff, type StaffDto } from '@/data/staff/staff.service'
import { useStaffStore } from '@/data/staff/staff.store'
import { useAuthStore } from '@/data/auth/auth.store'
import StaffReadonlyField from '../components/StaffReadonlyField.vue'
import {
  createStaffPayload,
  emptyStaffForm,
  staffFormFromRow,
  updateStaffPayload,
  type StaffFormState,
} from '../utils/staff-form-payload'
import { STAFF_ROLE_OPTIONS, type StaffRole } from '../utils/staff-presentation'

defineOptions({ name: 'StaffFormPage' })

const props = defineProps<{ staffId?: string }>()

const router = useRouter()
const authStore = useAuthStore()
const staffStore = useStaffStore()
const { status, email: googleEmail, isAdmin } = storeToRefs(authStore)
const { close } = useCloseRoute(props.staffId ? { name: 'staff-list' } : '/')

const isEdit = computed(() => Boolean(props.staffId))
const form = reactive<StaffFormState>(emptyStaffForm())
const row = ref<StaffDto | null>(null)
const original = ref<StaffFormState | null>(null)
const initializing = ref(isEdit.value)
const submitting = ref(false)
const formError = ref<string | null>(null)
let loadStarted = false

const displayEmail = computed(() => (isEdit.value ? row.value?.email : googleEmail.value) ?? '')
const isSelf = computed(() =>
  isEdit.value
  && row.value !== null
  && googleEmail.value !== null
  && row.value.email.toLowerCase() === googleEmail.value.toLowerCase(),
)
const roleOptions = computed(() =>
  STAFF_ROLE_OPTIONS.map((option) => ({ ...option, disabled: isSelf.value })),
)

const changes = computed(() => (original.value ? updateStaffPayload(form, original.value) : {}))
const canSubmit = computed(() => {
  if (submitting.value) return false
  if (!isEdit.value) {
    return status.value === 'unregistered' && registerStaffBodySchema.safeParse(createStaffPayload(form)).success
  }
  return (
    row.value !== null
    && Object.keys(changes.value).length > 0
    && updateStaffBodySchema.safeParse(changes.value).success
  )
})

const copy = computed(() =>
  isEdit.value
    ? {
        eyebrow: 'STAFF / EDIT',
        title: 'แก้ไขข้อมูลพนักงาน',
        helper: 'ปรับข้อมูล สิทธิ์ และสถานะการใช้งานของพนักงาน',
        submit: 'บันทึก',
      }
    : {
        eyebrow: 'STAFF / REGISTER',
        title: 'ลงทะเบียนพนักงาน',
        helper: 'กรอกข้อมูลของคุณ แล้วรอผู้ดูแลอนุมัติก่อนเริ่มใช้งาน',
        submit: 'ลงทะเบียน',
      },
)

function applyGuard(): void {
  if (status.value === 'loading') return

  if (isEdit.value) {
    if (!isAdmin.value) void router.replace('/')
    else void loadRow()
    return
  }

  if (status.value === 'unregistered') return
  void router.replace(status.value === 'signedIn' ? '/' : '/login')
}

async function loadRow(): Promise<void> {
  if (loadStarted || !props.staffId) return
  loadStarted = true
  try {
    const loaded = await getStaff(props.staffId)
    row.value = loaded
    original.value = staffFormFromRow(loaded)
    Object.assign(form, staffFormFromRow(loaded))
  } catch (reason) {
    formError.value = reason instanceof ApiError && reason.status === 404
      ? 'ไม่พบข้อมูลพนักงานนี้'
      : 'ไม่สามารถโหลดข้อมูลพนักงานได้'
  } finally {
    initializing.value = false
  }
}

function setRole(value: string | null): void {
  form.role = (value ?? '') as StaffRole | ''
}

async function submit(): Promise<void> {
  if (!canSubmit.value) return
  formError.value = null
  submitting.value = true
  try {
    if (props.staffId) {
      const updated = await updateStaff(props.staffId, changes.value)
      staffStore.upsert(updated)
      await router.replace({ name: 'staff-list' })
    } else {
      const created = await registerStaff(createStaffPayload(form))
      authStore.markPending(created)
      await router.replace('/login')
    }
  } catch (reason) {
    formError.value = await describeError(reason)
  } finally {
    submitting.value = false
  }
}

async function describeError(reason: unknown): Promise<string> {
  if (reason instanceof ApiError && reason.status === 409) {
    if (isEdit.value) return 'ไม่สามารถเปลี่ยนสิทธิ์หรือสถานะการใช้งานของตัวเองได้'
    await authStore.recheck()
    return 'บัญชีนี้ลงทะเบียนแล้ว'
  }
  if (reason instanceof ApiError && reason.status === 403) return 'คุณไม่มีสิทธิ์ดำเนินการนี้'
  return reason instanceof Error ? reason.message : 'บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง'
}

watch(status, applyGuard, { immediate: true })

onMounted(() => void authStore.ready())
</script>

<template>
  <FormOverlay
    :open="true"
    :eyebrow="copy.eyebrow"
    :title="copy.title"
    :helper-text="copy.helper"
    :submit-label="copy.submit"
    :is-submitting="submitting"
    :is-submit-disabled="initializing || !canSubmit"
    :close-on-backdrop="false"
    @close="close"
    @submit="submit"
  >
    <div class="space-y-4">
      <StaffReadonlyField v-if="isEdit" id="staff-id" label="รหัสพนักงาน" :value="props.staffId ?? ''" />
      <StaffReadonlyField id="staff-email" label="อีเมล" :value="displayEmail" />

      <FormInput
        id="staff-name"
        label="ชื่อ-นามสกุล *"
        :model-value="form.name"
        autocomplete="name"
        @update:model-value="form.name = $event"
      />
      <FormInput
        id="staff-phone"
        label="เบอร์โทรศัพท์ *"
        type="tel"
        inputmode="tel"
        autocomplete="tel"
        :model-value="form.phone"
        @update:model-value="form.phone = $event"
      />
      <FormTextarea
        id="staff-address"
        label="ที่อยู่ *"
        :model-value="form.address"
        @update:model-value="form.address = $event"
      />

      <template v-if="isEdit">
        <FormOptionGrid
          label="สิทธิ์การใช้งาน"
          variant="compact"
          :options="roleOptions"
          :model-value="form.role"
          @update:model-value="setRole"
        />
        <FormInput
          id="staff-position"
          label="ตำแหน่ง"
          :model-value="form.position"
          @update:model-value="form.position = $event"
        />
        <FormInput
          id="staff-start-date"
          label="วันที่เริ่มงาน"
          type="date"
          :model-value="form.startDate"
          @update:model-value="form.startDate = $event"
        />
        <div :inert="isSelf" :class="{ 'opacity-50': isSelf }">
          <FormSwitch
            :model-value="form.active"
            label="เปิดใช้งาน"
            :description="isSelf ? 'ไม่สามารถเปลี่ยนสิทธิ์หรือสถานะของตัวเองได้' : 'ปิดสวิตช์เพื่อไม่ให้พนักงานคนนี้เข้าใช้งานระบบ'"
            @update:model-value="form.active = $event"
          />
        </div>
      </template>

      <p v-if="formError" class="rounded-lg bg-error-container px-3 py-2 text-sm text-on-error-container" role="alert">
        {{ formError }}
      </p>
    </div>
  </FormOverlay>
</template>
