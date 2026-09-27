<script setup lang="ts">
import { onMounted, provide } from 'vue'
import { storeToRefs } from 'pinia'
import { useAppointmentStore } from '@/data/appointments/appointment.store'
import { useCustomerStore } from '@/data/customers/customer.store'
import { usePriceListStore } from '@/data/price-list/price-list.store'
import { appointmentPendingCountKey } from '@/shared/appointment-pending-count'
import { APP_Z_INDEX_CLASS } from '@/shared/layouts/z-index'

const appointmentStore = useAppointmentStore()
const customerStore = useCustomerStore()
const priceListStore = usePriceListStore()
const { pendingCount } = storeToRefs(appointmentStore)

provide(appointmentPendingCountKey, pendingCount)

// Keep the schedule and pending badge ready from the same backend-backed store.
onMounted(() => {
  void appointmentStore.loadInitial()
  void customerStore.loadCustomers()
  void priceListStore.load()
})
</script>

<template>
  <div
    class="app-column relative flex h-full flex-col overflow-hidden bg-surface sm:border-x sm:border-outline-variant/30 sm:shadow-2xl"
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
</template>
