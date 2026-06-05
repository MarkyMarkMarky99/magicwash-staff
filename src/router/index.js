import { defineAsyncComponent, h } from 'vue'
import { createRouter, createWebHashHistory, RouterLink } from 'vue-router'
import DailyTasksPage from '../pages/DailyTasksPage.vue'
import BookingFormPage from '../pages/BookingFormPage.vue'
import PendingPage from '../pages/PendingPage.vue'
import CustomersPage from '../pages/CustomersPage.vue'
import OrderGalleryPage from '../pages/OrderGalleryPage.vue'
import FormOverlayPage from '../pages/FormOverlayPage.vue'

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

const routes = [
  { path: '/',             component: DailyTasksPage },
  { path: '/pending',      component: PendingPage },
  { path: '/reschedule',   component: BookingFormPage, props: { mode: 'reschedule' } },
  { path: '/new-booking',  component: BookingFormPage, props: { mode: 'new-booking' } },
  { path: '/customers',    component: CustomersPage },
  { path: '/forms',        component: FormsIndexRoute },
  { path: '/forms/:formName', component: FormOverlayPage },
  { path: '/gallery/:key/camera', component: OrderGalleryPage, meta: { openCamera: true } },
  { path: '/gallery/:key', component: OrderGalleryPage },
  { path: '/orders/:orderId/gallery/camera', redirect: to => ({ path: `/gallery/AFT-${to.params.orderId}/camera`, query: to.query }) },
  { path: '/orders/:orderId/gallery', redirect: to => ({ path: `/gallery/AFT-${to.params.orderId}`, query: to.query }) },
]

export default createRouter({
  history: createWebHashHistory(),
  routes,
})
