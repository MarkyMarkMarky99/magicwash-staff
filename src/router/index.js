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
  { path: '/orders/:orderId/gallery', component: OrderGalleryPage },
]

export default createRouter({
  history: createWebHashHistory(),
  routes,
})
