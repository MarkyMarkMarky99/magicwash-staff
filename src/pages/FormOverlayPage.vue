/**
 * @fileoverview Generic overlay page — wraps any form component from components/forms/*.vue.
 * Route :formName must be the kebab-case filename, e.g. /forms/create-order-form.
 * Each form's submit action is declared in formConfigs / scheduleConfigs below.
 */
<script setup>
import { computed, defineAsyncComponent, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import FormOverlayLayout from '../layouts/FormOverlayLayout.vue'
import { handleAppend, handleUpdate } from '../utils/gateway'

// ── Form discovery ──────────────────────────────────────────────────────────
const formModules = import.meta.glob('../components/forms/*.vue')

function _nameFromPath(path) {
  return path.split('/').pop().replace(/\.vue$/, '')
}

function _toKebabCase(str) {
  return str.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/[\s_]+/g, '-').toLowerCase()
}

// keyed by kebab-case filename → { name: PascalCase, component }
const formMap = Object.fromEntries(
  Object.entries(formModules).map(([path, loader]) => {
    const name = _nameFromPath(path)
    return [_toKebabCase(name), { name, component: defineAsyncComponent(loader) }]
  })
)

// ── Per-form config: UI labels + gateway submit action ──────────────────────
const formConfigs = {
  CreateOrderForm: {
    title: 'Create New Order',
    submitLabel: 'Create Order',
    submitIcon: 'add_circle',
    submit: (data) => handleAppend('Orders', data),
  },
}

const scheduleConfigs = {
  'new-booking': {
    title: 'New Booking',
    submitLabel: 'Confirm Booking',
    submitIcon: 'add_circle',
    submit: (data) => handleAppend('Appointments', {
      customerId:      data.customerId,
      appointmentDate: data.date,
      timeSlot:        data.time,
      appointmentType: data.serviceType,
      notes:           data.notes,
    }),
  },
  reschedule: {
    title: 'Reschedule Appointment',
    submitLabel: 'Confirm Reschedule',
    submitIcon: 'check_circle',
    submit: (data) => handleUpdate('Appointments', data.appointmentId, {
      appointmentDate: data.date,
      timeSlot:        data.time,
      status:          'PENDING',
      notes:           data.reason,
    }),
  },
}

// ── Route-driven state ───────────────────────────────────────────────────────
const route   = useRoute()
const router  = useRouter()
const formRef    = ref(null)
const submitting  = ref(false)
const submitError = ref(null)

const routeKey = computed(() => {
  const p = route.params.formName
  return _toKebabCase(String(Array.isArray(p) ? p[0] : p))
})

const formMode = computed(() => {
  const q = route.query.mode
  return (Array.isArray(q) ? q[0] : q) === 'reschedule' ? 'reschedule' : 'new-booking'
})

const formEntry     = computed(() => formMap[routeKey.value] || null)
const formName      = computed(() => formEntry.value?.name || null)
const formComponent = computed(() => formEntry.value?.component || null)

const formConfig = computed(() => {
  if (formName.value === 'AppointmentScheduleForm') return scheduleConfigs[formMode.value]
  return formConfigs[formName.value] ?? {
    title: formName.value || 'Form',
    submitLabel: 'Submit',
    submitIcon: 'check_circle',
    submit: null,
  }
})

const canSubmit = computed(() => Boolean(formRef.value?.isValid))

// 1. Guard → 2. Call gateway → 3. Navigate back on success, show error on failure
async function handleSubmit() {
  if (!canSubmit.value || submitting.value || !formConfig.value.submit) return
  submitting.value  = true
  submitError.value = null
  try {
    await formConfig.value.submit(formRef.value.data)
    router.back()
  } catch (err) {
    submitError.value = err.message || 'เกิดข้อผิดพลาด'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <FormOverlayLayout
    v-if="formComponent"
    :title="formConfig.title"
    :submit-label="formConfig.submitLabel"
    :submit-icon="formConfig.submitIcon"
    :can-submit="canSubmit"
    :submitting="submitting"
    @back="router.back()"
    @submit="handleSubmit"
  >
    <div
      v-if="submitError"
      class="mx-4 mt-4 flex items-center gap-2 px-4 py-3 rounded-xl bg-error-container text-on-error-container text-sm font-body"
    >
      <span class="material-symbols-outlined text-[18px] shrink-0">error</span>
      {{ submitError }}
    </div>

    <component
      :is="formComponent"
      ref="formRef"
      v-bind="formName === 'AppointmentScheduleForm' ? { mode: formMode } : {}"
    />
  </FormOverlayLayout>

  <div v-else class="h-full bg-surface text-on-surface font-body overflow-y-auto">
    <header class="bg-primary text-on-primary px-4 py-3 shadow-md">
      <h1 class="text-lg font-headline font-bold tracking-tight">Form Not Found</h1>
    </header>
    <main class="px-6 py-5 space-y-3">
      <p class="text-sm text-on-surface-variant">No form matching "{{ routeKey }}" exists in src/components/forms.</p>
      <RouterLink to="/forms" class="inline-flex items-center text-sm font-bold text-primary">View all forms</RouterLink>
    </main>
  </div>
</template>
