import { h, ref } from 'vue'
import { createRouter, createWebHashHistory } from 'vue-router'
import DailyTasksPage from '../pages/DailyTasksPage.vue'
import RescheduleFormPage from '../pages/RescheduleFormPage.vue'
import NewBookingPage from '../pages/NewBookingPage.vue'
import PendingPage from '../pages/PendingPage.vue'
import CustomersPage from '../pages/CustomersPage.vue'
import OrderGalleryPage from '../pages/OrderGalleryPage.vue'
import JobTrackingPage from '../pages/JobTrackingPage.vue'
import DriverPhotoPage from '../pages/DriverPhotoPage.vue'
import { CameraWorkspace, SinglePhotoCameraInput } from '../components/camera'

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

const SingleCameraTestRoute = {
  name: 'SingleCameraTestRoute',
  setup() {
    const returnedUrl = ref('')

    function handleChange(url) {
      returnedUrl.value = url
      console.log('Single camera URL:', url)
    }

    function handleUploadSuccess(url, item) {
      returnedUrl.value = url
      console.log('Single camera uploaded URL:', url)
      console.log('Single camera uploaded item:', item)
    }

    function handleUploadError(message) {
      console.error('Single camera upload error:', message)
    }

    return () => h(SinglePhotoCameraInput, {
      modelValue: returnedUrl.value,
      uploadFolder: 'camera-single-input-upload-test',
      filenamePrefix: 'camera_single_input_test',
      metadata: { source: 'camera-single-input-upload-test' },
      onChange: handleChange,
      onUploadSuccess: handleUploadSuccess,
      onUploadError: handleUploadError,
      'onUpdate:modelValue': value => {
        returnedUrl.value = value
      },
    }, {
      'camera-top': () => h('div', { class: 'min-w-0 flex-1 text-center' }, [
        h('p', { class: 'truncate text-sm font-semibold text-white' }, 'ทดสอบถ่ายภาพเดียว'),
      ]),
      'preview-top': () => h('div', { class: 'text-center' }, [
        h('p', { class: 'text-sm font-semibold text-white' }, 'ตรวจสอบรูปก่อนอัปโหลด'),
      ]),
      'preview-bottom': () => returnedUrl.value
        ? h('p', { class: 'mb-3 rounded-lg bg-white/85 px-3 py-2 text-xs font-medium text-black' }, [
          'Returned URL: ',
          h('span', { class: 'break-all text-primary' }, returnedUrl.value),
        ])
        : null,
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
  { path: '/driver/photo/:photoCode', component: DriverPhotoPage },
  { path: '/camera', component: CameraRoute },
  { path: '/camera-single', component: SingleCameraTestRoute },
  { path: '/camera-gallery-preview', redirect: '/camera' },
  { path: '/gallery/:key/camera', redirect: to => ({ path: `/gallery/${to.params.key}`, query: to.query }) },
  { path: '/gallery/:key', component: OrderGalleryPage },
  { path: '/orders/:orderId/gallery/camera', redirect: to => ({ path: `/gallery/AFT-${to.params.orderId}`, query: to.query }) },
  { path: '/orders/:orderId/gallery', redirect: to => ({ path: `/gallery/AFT-${to.params.orderId}`, query: to.query }) },
]

export default createRouter({
  history: createWebHashHistory(),
  routes,
})
