import type { RouteRecordRaw } from 'vue-router'
import { APPOINTMENT_CREATE_ROUTE_NAME } from '@/shared/navigation/form-routes'

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
    meta: { parent: 'appointment-schedule' },
  },
  {
    path: '/new-booking',
    name: APPOINTMENT_CREATE_ROUTE_NAME,
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
