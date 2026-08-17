import type { RouteRecordRaw } from 'vue-router'
import OrderGalleryPage from './pages/OrderGalleryPage.vue'

export const galleryRoutes: RouteRecordRaw[] = [
  { path: '/gallery/:key/camera', component: OrderGalleryPage, meta: { openCamera: true } },
  { path: '/gallery/:key', component: OrderGalleryPage },
  { path: '/orders/:orderId/gallery/camera', redirect: to => ({ path: `/gallery/AFT-${to.params.orderId}/camera`, query: to.query }) },
  { path: '/orders/:orderId/gallery', redirect: to => ({ path: `/gallery/AFT-${to.params.orderId}`, query: to.query }) },
]
