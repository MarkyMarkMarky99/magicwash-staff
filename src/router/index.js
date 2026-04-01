import { createRouter, createWebHashHistory } from 'vue-router'
import DailyTasksPage from '../pages/DailyTasksPage.vue'
import RescheduleFormPage from '../pages/RescheduleFormPage.vue'
import BookPickupPage from '../pages/BookPickupPage.vue'
import PendingPage from '../pages/PendingPage.vue'

const routes = [
  { path: '/',            component: DailyTasksPage },
  { path: '/pending',     component: PendingPage },
  { path: '/reschedule',  component: RescheduleFormPage },
  { path: '/book-pickup', component: BookPickupPage },
]

export default createRouter({
  history: createWebHashHistory(),
  routes,
})
