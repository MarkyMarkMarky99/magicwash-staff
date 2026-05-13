import { createRouter, createWebHashHistory } from 'vue-router'
import DailyTasksPage from '../pages/DailyTasksPage.vue'
import RescheduleFormPage from '../pages/RescheduleFormPage.vue'
import NewBookingPage from '../pages/NewBookingPage.vue'
import PendingPage from '../pages/PendingPage.vue'
import CustomersPage from '../pages/CustomersPage.vue'
import OrderGalleryPage from '../pages/OrderGalleryPage.vue'

const routes = [
  { path: '/',             component: DailyTasksPage },
  { path: '/pending',      component: PendingPage },
  { path: '/reschedule',   component: RescheduleFormPage },
  { path: '/new-booking',  component: NewBookingPage },
  { path: '/customers',    component: CustomersPage },
  { path: '/gallery/:key/camera', component: OrderGalleryPage, meta: { openCamera: true } },
  { path: '/gallery/:key', component: OrderGalleryPage },
  { path: '/orders/:orderId/gallery/camera', redirect: to => ({ path: `/gallery/AFT-${to.params.orderId}/camera`, query: to.query }) },
  { path: '/orders/:orderId/gallery', redirect: to => ({ path: `/gallery/AFT-${to.params.orderId}`, query: to.query }) },
]

export default createRouter({
  history: createWebHashHistory(),
  routes,
})
