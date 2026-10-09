<script setup lang="ts">
import { computed, onMounted, onUnmounted, provide, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useAppointmentStore } from '@/data/appointments/appointment.store'
import { useAuthStore } from '@/data/auth/auth.store'
import { useCustomerStore } from '@/data/customers/customer.store'
import { usePriceListStore } from '@/data/price-list/price-list.store'
import { useStaffStore } from '@/data/staff/staff.store'
import { appointmentPendingCountKey } from '@/shared/appointment-pending-count'
import { staffSignedInKey } from '@/shared/staff-session'
import { APP_Z_INDEX_CLASS } from '@/shared/layouts/z-index'
import { useNavDrawer } from '@/shared/composables/use-nav-drawer'
import { useRoute, useRouter } from 'vue-router'
import NavSidebar from '@/shared/components/NavSidebar.vue'
import { preloadDocumentScanner } from '@/features/orders/utils/document-scanner-model'

const appointmentStore = useAppointmentStore()
const customerStore = useCustomerStore()
const staffStore = useStaffStore()
const priceListStore = usePriceListStore()
const authStore = useAuthStore()
const { pendingCount } = storeToRefs(appointmentStore)
const route = useRoute()
const router = useRouter()
const { isOpen: drawerOpen, close: closeDrawer } = useNavDrawer()
const appShell = ref<HTMLElement | null>(null)
const isPublicRoute = computed(() => route.meta.public === true)

type Drag = {
  pointerId: number
  startX: number
  startY: number
  openOffset: number
  mode: 'pending' | 'dragging' | 'ignored'
  positions: { x: number; time: number }[]
}

let drag: Drag | null = null
let suppressClick = false

function clearDragStyles() {
  const shell = appShell.value
  if (!shell) return
  shell.style.removeProperty('translate')
  shell.style.removeProperty('border-radius')
  shell.style.removeProperty('box-shadow')
  shell.style.removeProperty('transition')
}

watch(drawerOpen, (open) => {
  if (!open) {
    drag = null
    clearDragStyles()
  }
}, { flush: 'post' })

function onClosePointerDown(event: PointerEvent) {
  if (event.button !== 0 || !event.isPrimary || !appShell.value) return
  const openOffset = Math.min(appShell.value.getBoundingClientRect().width * 0.78, 320)
  if (openOffset <= 0) return
  const layer = event.currentTarget as HTMLElement
  layer.setPointerCapture(event.pointerId)
  suppressClick = false
  drag = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    openOffset,
    mode: 'pending',
    positions: [{ x: event.clientX, time: event.timeStamp }],
  }
}

function onClosePointerMove(event: PointerEvent) {
  if (!drag || drag.pointerId !== event.pointerId || drag.mode === 'ignored') return
  const dx = event.clientX - drag.startX
  const dy = event.clientY - drag.startY
  if (drag.mode === 'pending') {
    if (Math.hypot(dx, dy) < 8) return
    drag.mode = Math.abs(dy) > Math.abs(dx) ? 'ignored' : 'dragging'
    if (drag.mode === 'ignored') return
  }

  const offset = Math.max(0, Math.min(drag.openOffset, drag.openOffset + dx))
  const progress = offset / drag.openOffset
  const shell = appShell.value
  if (!shell) return
  shell.style.transition = 'none'
  shell.style.translate = `${offset}px 0`
  shell.style.borderRadius = `${36 * progress}px`
  shell.style.boxShadow = `-8px 0 32px color-mix(in srgb, var(--color-on-surface) ${25 * progress}%, transparent)`
  drag.positions.push({ x: event.clientX, time: event.timeStamp })
  while (drag.positions.length > 2 && drag.positions[1]!.time < event.timeStamp - 100) {
    drag.positions.shift()
  }
}

function onClosePointerUp(event: PointerEvent) {
  if (!drag || drag.pointerId !== event.pointerId) return
  const currentDrag = drag
  drag = null
  const dx = event.clientX - currentDrag.startX
  const dy = event.clientY - currentDrag.startY
  if (currentDrag.mode !== 'dragging') {
    suppressClick = Math.hypot(dx, dy) >= 8
    return
  }

  suppressClick = true
  const offset = Math.max(0, Math.min(currentDrag.openOffset, currentDrag.openOffset + dx))
  const first = currentDrag.positions.find(position => position.time >= event.timeStamp - 100)
    ?? currentDrag.positions.at(-1)!
  const velocity = (event.clientX - first.x) / Math.max(1, event.timeStamp - first.time)
  if (offset <= currentDrag.openOffset * 0.7 || velocity < -0.5) {
    closeDrawer()
  } else {
    clearDragStyles()
  }
}

function onClosePointerCancel(event: PointerEvent) {
  if (!drag || drag.pointerId !== event.pointerId) return
  drag = null
  suppressClick = true
  clearDragStyles()
}

function onCloseClick() {
  if (suppressClick) {
    suppressClick = false
    return
  }
  closeDrawer()
}

watch(() => route.path, () => {
  if (!drawerOpen.value) return
  const query = { ...route.query }
  delete query.menu
  void router.replace({ query })
})

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') closeDrawer()
}

provide(appointmentPendingCountKey, pendingCount)
provide(staffSignedInKey, computed(() => authStore.status === 'signedIn'))

// Keep the schedule and pending badge ready from the same backend-backed store.
onMounted(async () => {
  window.addEventListener('keydown', onKeydown)
  await router.isReady()
  if (isPublicRoute.value) return
  preloadDocumentScanner()
  void authStore.ready()
  const stopPrefetch = watch(() => authStore.status, (status) => {
    if (status !== 'signedIn') return
    void appointmentStore.loadInitial()
    void customerStore.loadCustomers()
    void staffStore.load()
    void priceListStore.load()
    queueMicrotask(() => stopPrefetch())
  }, { immediate: true })
})

onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div class="app-column relative h-full overflow-hidden bg-surface">
    <NavSidebar v-if="!isPublicRoute" :open="drawerOpen" />

    <div
      ref="appShell"
      class="app-column relative flex h-full flex-col overflow-hidden bg-surface transition-[translate,border-radius,box-shadow] duration-[320ms] ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none sm:border-x sm:border-outline-variant/30 sm:shadow-2xl"
      :class="drawerOpen ? 'translate-x-[min(78%,320px)] rounded-[36px] shadow-[-8px_0_32px_color-mix(in_srgb,var(--color-on-surface)_25%,transparent)]' : ''"
      :inert="drawerOpen"
    >
      <div
        id="overlay-root"
        :class="['pointer-events-none absolute inset-0 sm:-inset-px', APP_Z_INDEX_CLASS.overlay]"
      />

      <RouterView v-slot="{ Component }">
      <!-- Form pages must not be cached: their component-local refs would otherwise survive across subjects. `exclude` matches component names, so renaming one of these files silently removes it from this list. -->
      <KeepAlive
        :exclude="['WashQueuePage', 'CreateAppointmentPage', 'RescheduleAppointmentPage', 'InvoiceCreatePage', 'InvoicePaymentFormPage', 'InvoicePaymentReviewPage', 'CustomerCreatePage', 'CustomerPackageCreatePage', 'PriceListFormPage', 'PriceListItemCreatePage', 'PackageFormPage', 'IssueReportFormPage', 'OrderCreatePage', 'StaffFormPage']"
      >
        <component :is="Component" />
      </KeepAlive>
      </RouterView>
    </div>

    <button
      v-if="drawerOpen"
      type="button"
      aria-label="Close menu"
      class="app-column absolute inset-0 z-[70] h-full translate-x-[min(78%,320px)] cursor-default rounded-[36px] border-0 bg-transparent p-0 [touch-action:pan-y]"
      @pointerdown="onClosePointerDown"
      @pointermove="onClosePointerMove"
      @pointerup="onClosePointerUp"
      @pointercancel="onClosePointerCancel"
      @click="onCloseClick"
    />
  </div>
</template>
