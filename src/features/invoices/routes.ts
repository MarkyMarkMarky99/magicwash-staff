import type { RouteRecordRaw } from 'vue-router'
import { INVOICE_CREATE_ROUTE_NAME } from '@/shared/navigation/form-routes'

export const invoiceRoutes: RouteRecordRaw[] = [
  {
    path: '/invoices',
    name: 'invoice-list',
    component: () => import('./pages/InvoiceListPage.vue'),
  },
  {
    path: '/invoices/create',
    name: INVOICE_CREATE_ROUTE_NAME,
    component: () => import('./pages/InvoiceCreatePage.vue'),
    meta: { parent: 'invoice-list' },
  },
  {
    path: '/invoices/:invoiceNumber',
    name: 'invoice-detail',
    component: () => import('./pages/InvoiceDetailPage.vue'),
    meta: { parent: 'invoice-list' },
    props: true,
  },
  {
    path: '/invoices-new',
    redirect: (to) => ({ name: 'invoice-list', query: to.query }),
  },
  {
    path: '/invoices-new/create',
    redirect: (to) => ({ name: 'invoice-create', query: to.query }),
  },
  {
    path: '/invoices-new/:invoiceNumber',
    redirect: (to) => ({
      name: 'invoice-detail',
      params: { invoiceNumber: to.params.invoiceNumber },
      query: to.query,
    }),
  },
]
