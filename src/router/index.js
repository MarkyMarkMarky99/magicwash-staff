import { computed, defineAsyncComponent, h, ref } from 'vue'
import { createRouter, createWebHashHistory, RouterLink, useRoute, useRouter } from 'vue-router'
import DailyTasksPage from '../pages/DailyTasksPage.vue'
import RescheduleFormPage from '../pages/RescheduleFormPage.vue'
import NewBookingPage from '../pages/NewBookingPage.vue'
import PendingPage from '../pages/PendingPage.vue'
import CustomersPage from '../pages/CustomersPage.vue'
import OrderGalleryPage from '../pages/OrderGalleryPage.vue'
import JobTrackingPage from '../pages/JobTrackingPage.vue'
import FormOverlayLayout from '../layouts/FormOverlayLayout.vue'
import { CameraWorkspace } from '../components/camera'

const formModules = import.meta.glob('../components/forms/*.vue')

function formNameFromPath(path) {
  return path.split('/').pop().replace(/\.vue$/, '')
}

function toKebabCase(value) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase()
}

const formComponents = Object.fromEntries(
  Object.entries(formModules).map(([path, loader]) => [
    formNameFromPath(path),
    defineAsyncComponent(loader),
  ]),
)

const formAliases = Object.fromEntries(
  Object.keys(formComponents).flatMap(name => [
    [name, name],
    [name.toLowerCase(), name],
    [toKebabCase(name), name],
  ]),
)

Object.assign(formAliases, {
  NewBookingForm: 'AppointmentScheduleForm',
  newbookingform: 'AppointmentScheduleForm',
  'new-booking-form': 'AppointmentScheduleForm',
  RescheduleAppointmentForm: 'AppointmentScheduleForm',
  rescheduleappointmentform: 'AppointmentScheduleForm',
  'reschedule-appointment-form': 'AppointmentScheduleForm',
})

const formConfigs = {
  CreateOrderForm: {
    title: 'Create New Order',
    submitLabel: 'Create Order',
    submitIcon: 'add_circle',
  },
}

const appointmentScheduleConfigs = {
  'new-booking': {
    title: 'New Booking',
    submitLabel: 'Confirm Booking',
    submitIcon: 'add_circle',
  },
  reschedule: {
    title: 'Reschedule Appointment',
    submitLabel: 'Confirm Reschedule',
    submitIcon: 'check_circle',
  },
}

function routeMode(rawName, route) {
  const normalizedName = toKebabCase(String(rawName))
  if (normalizedName === 'reschedule-appointment-form') return 'reschedule'
  if (normalizedName === 'new-booking-form') return 'new-booking'

  const queryMode = Array.isArray(route.query.mode) ? route.query.mode[0] : route.query.mode
  return queryMode === 'reschedule' ? 'reschedule' : 'new-booking'
}

const FormsIndexRoute = {
  name: 'FormsIndexRoute',
  setup() {
    const formNames = Object.keys(formComponents).sort()

    return () => h('div', { class: 'h-full bg-surface text-on-surface font-body overflow-y-auto' }, [
      h('header', { class: 'bg-primary text-on-primary px-4 py-3 shadow-md' }, [
        h('h1', { class: 'text-lg font-headline font-bold tracking-tight' }, 'Forms'),
      ]),
      h('main', { class: 'px-6 py-5 space-y-3' }, formNames.length
        ? formNames.map(name => h(RouterLink, {
          key: name,
          to: `/forms/${toKebabCase(name)}`,
          class: 'flex items-center justify-between rounded-xl bg-surface-container border border-outline-variant/30 px-4 py-3 text-sm font-body text-on-surface hover:bg-surface-container-high transition-colors',
        }, () => [
          h('span', { class: 'font-medium' }, name),
          h('span', { class: 'material-symbols-outlined text-[20px] text-on-surface-variant' }, 'chevron_right'),
        ]))
        : [
          h('p', { class: 'text-sm text-on-surface-variant' }, 'No form components found.'),
        ]),
    ])
  },
}

const FormFileRoute = {
  name: 'FormFileRoute',
  setup() {
    const route = useRoute()
    const router = useRouter()
    const formRef = ref(null)
    const rawFormName = computed(() => {
      const rawName = Array.isArray(route.params.formName)
        ? route.params.formName[0]
        : route.params.formName
      return String(rawName)
    })
    const currentFormName = computed(() => {
      const normalizedName = toKebabCase(rawFormName.value)
      return formAliases[rawFormName.value] || formAliases[rawFormName.value.toLowerCase()] || formAliases[normalizedName] || null
    })
    const currentComponent = computed(() => formComponents[currentFormName.value] || null)
    const currentMode = computed(() => routeMode(rawFormName.value, route))
    const currentConfig = computed(() => {
      if (currentFormName.value === 'AppointmentScheduleForm') {
        return appointmentScheduleConfigs[currentMode.value]
      }

      return formConfigs[currentFormName.value] || {
        title: currentFormName.value || 'Form',
        submitLabel: 'Submit',
        submitIcon: 'check_circle',
      }
    })
    const canSubmit = computed(() => Boolean(formRef.value?.isValid))

    function handleFormSubmit() {
      console.log('Form submit payload:', formRef.value?.data)
    }

    return () => currentComponent.value
      ? h(FormOverlayLayout, {
        title: currentConfig.value.title,
        submitLabel: currentConfig.value.submitLabel,
        submitIcon: currentConfig.value.submitIcon,
        canSubmit: canSubmit.value,
        onBack: () => router.back(),
        onSubmit: handleFormSubmit,
      }, {
        default: () => h(currentComponent.value, {
          ref: formRef,
          ...(currentFormName.value === 'AppointmentScheduleForm' ? { mode: currentMode.value } : {}),
        }),
      })
      : h('div', { class: 'h-full bg-surface text-on-surface font-body overflow-y-auto' }, [
        h('header', { class: 'bg-primary text-on-primary px-4 py-3 shadow-md' }, [
          h('h1', { class: 'text-lg font-headline font-bold tracking-tight' }, 'Form Not Found'),
        ]),
        h('main', { class: 'px-6 py-5 space-y-3' }, [
          h('p', { class: 'text-sm text-on-surface-variant' }, 'No matching form component exists in src/components/forms.'),
          h(RouterLink, { to: '/forms', class: 'inline-flex items-center text-sm font-bold text-primary' }, () => 'View forms'),
        ]),
      ])
  },
}

const CameraRoute = {
  name: 'CameraRoute',
  setup() {
    const cameraRef = ref(null)

    function handleChange(data) {
      console.log('Camera payload:', data)
    }

    function handleSubmit(items) {
      console.log('Camera uploaded items:', items)
    }

    return () => h(CameraWorkspace, {
      ref: cameraRef,
      title: 'Camera',
      emptyText: 'ยังไม่มีรูปภาพ',
      openCameraOnMount: true,
      onChange: handleChange,
      onSubmit: handleSubmit,
    })
  },
}

const routes = [
  { path: '/',             component: DailyTasksPage },
  { path: '/pending',      component: PendingPage },
  { path: '/reschedule',   component: RescheduleFormPage },
  { path: '/new-booking',  component: NewBookingPage },
  { path: '/customers',    component: CustomersPage },
  { path: '/job-tracking', component: JobTrackingPage },
  { path: '/camera', component: CameraRoute },
  { path: '/camera-gallery-preview', redirect: '/camera' },
  { path: '/forms',        component: FormsIndexRoute },
  { path: '/forms/:formName', component: FormFileRoute },
  { path: '/gallery/:key/camera', redirect: to => ({ path: `/gallery/${to.params.key}`, query: to.query }) },
  { path: '/gallery/:key', component: OrderGalleryPage },
  { path: '/orders/:orderId/gallery/camera', redirect: to => ({ path: `/gallery/AFT-${to.params.orderId}`, query: to.query }) },
  { path: '/orders/:orderId/gallery', redirect: to => ({ path: `/gallery/AFT-${to.params.orderId}`, query: to.query }) },
]

export default createRouter({
  history: createWebHashHistory(),
  routes,
})
