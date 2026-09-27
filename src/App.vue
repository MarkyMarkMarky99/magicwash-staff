<script setup lang="ts">
import { onMounted, onUnmounted, provide, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useAppointmentStore } from '@/data/appointments/appointment.store'
import { useCustomerStore } from '@/data/customers/customer.store'
import { usePriceListStore } from '@/data/price-list/price-list.store'
import { appointmentPendingCountKey } from '@/shared/appointment-pending-count'
import { APP_Z_INDEX_CLASS } from '@/shared/layouts/z-index'
import { useNavDrawer } from '@/shared/composables/use-nav-drawer'
import { useRoute, useRouter } from 'vue-router'
import NavSidebar from '@/shared/components/NavSidebar.vue'

const appointmentStore = useAppointmentStore()
const customerStore = useCustomerStore()
const priceListStore = usePriceListStore()
const { pendingCount } = storeToRefs(appointmentStore)
const route = useRoute()
const router = useRouter()
const { isOpen: drawerOpen, close: closeDrawer } = useNavDrawer()

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

// Keep the schedule and pending badge ready from the same backend-backed store.
onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  void appointmentStore.loadInitial()
  void customerStore.loadCustomers()
  void priceListStore.load()
})

onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div class="app-column relative h-full overflow-hidden bg-surface">
    <NavSidebar :open="drawerOpen" />

    <div
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
        :exclude="['CreateAppointmentPage', 'RescheduleAppointmentPage', 'InvoiceCreatePage', 'CustomerCreatePage', 'CustomerPackageCreatePage', 'PriceListFormPage', 'PriceListItemCreatePage', 'PackageFormPage', 'IssueReportFormPage', 'OrderCreatePage']"
      >
        <component :is="Component" />
      </KeepAlive>
      </RouterView>
    </div>

    <button
      v-if="drawerOpen"
      type="button"
      aria-label="Close menu"
      class="app-column absolute inset-0 z-[70] h-full translate-x-[min(78%,320px)] cursor-default rounded-[36px] border-0 bg-transparent p-0"
      @click="closeDrawer"
    />
  </div>
</template>
