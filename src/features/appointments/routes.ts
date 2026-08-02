import type { RouteRecordRaw } from 'vue-router'

export const appointmentRoutes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'appointment-schedule',
    component: () => import('./pages/AppointmentSchedulePage.vue'),
  },
  {
    path: '/pending',
    name: 'appointment-pending',
    component: () => import('./pages/PendingAppointmentsPage.vue'),
  },
  {
    path: '/new-booking',
    name: 'appointment-create',
    component: () => import('./pages/CreateAppointmentPage.vue'),
  },
  {
    path: '/reschedule/:appointmentId',
    name: 'appointment-reschedule',
    component: () => import('./pages/RescheduleAppointmentPage.vue'),
    props: true,
  },
  {
    path: '/reschedule',
    redirect: () => ({ name: 'appointment-schedule' }),
  },
]
