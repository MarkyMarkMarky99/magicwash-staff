import { createRouter, createWebHashHistory } from 'vue-router'
import DailyTasksPage from '../pages/DailyTasksPage.vue'
import RescheduleFormPage from '../pages/RescheduleFormPage.vue'
import BookPickupPage from '../pages/BookPickupPage.vue'

const routes = [
  { path: '/',            component: DailyTasksPage },
  { path: '/reschedule',  component: RescheduleFormPage },
  { path: '/book-pickup', component: BookPickupPage },
]

export default createRouter({
  history: createWebHashHistory(),
  routes,
})
