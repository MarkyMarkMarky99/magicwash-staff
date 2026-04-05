import { createRouter, createWebHashHistory } from 'vue-router'
import DailyTasksPage from '../pages/DailyTasksPage.vue'
import RescheduleFormPage from '../pages/RescheduleFormPage.vue'
import PendingPage from '../pages/PendingPage.vue'

const routes = [
  { path: '/',           component: DailyTasksPage },
  { path: '/pending',    component: PendingPage },
  { path: '/reschedule', component: RescheduleFormPage },
]

export default createRouter({
  history: createWebHashHistory(),
  routes,
})
