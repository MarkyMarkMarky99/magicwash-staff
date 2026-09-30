<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute, useRouter } from 'vue-router'
import { getOrderCreditUsage, type OrderCreditUsagePreview } from '@/data/customer-packages/order-credit-usage.service'
import AppLayout from '@/shared/layouts/AppLayout.vue'
import ScrollRegion from '@/shared/components/ScrollRegion.vue'
import BottomNavBar from '@/shared/components/BottomNavBar.vue'
import {
  appointmentCreateRoute,
  invoiceCreateRoute,
} from '@/shared/navigation/form-routes'
import { useCustomerOrderHistoryStore } from '../stores/customer-order-history.store'
import { useOrderSheetRoute } from '@/features/customers/composables/useOrderSheetRoute'
import OrderDetailSheet from '../components/OrderDetailSheet.vue'
import OrderHistoryCustomerCard from '../components/OrderHistoryCustomerCard.vue'
import OrderList from '../components/OrderList.vue'
import CustomerPackagesSection from '../components/CustomerPackagesSection.vue'
import CustomerInvoicesSection from '../components/CustomerInvoicesSection.vue'
import CustomerAppointmentsSection from '../components/CustomerAppointmentsSection.vue'
import CustomerSectionIcon from '../components/CustomerSectionIcon.vue'
import OrderPackageUsageOverlay from '../components/OrderPackageUsageOverlay.vue'
import { useCustomerPackagesStore } from '../stores/customer-packages.store'
import { useCustomerInvoicesStore } from '@/data/invoices/customer-invoices.store'
import { useOrderPackageUsageRoute } from '../composables/useOrderPackageUsageRoute'
import { resolveCustomerTab } from '../utils/customer-tab'
import { currentActor } from '@/shared/config/actor'

const props = defineProps<{
  customerId: string
  tab?: string
}>()

const router = useRouter()
const route = useRoute()
const activeTab = computed(() => resolveCustomerTab(props.tab))
const items = [
  { key: 'orders', icon: 'local_laundry_service', label: 'Orders' },
  { key: 'packages', icon: 'confirmation_number', label: 'Packages' },
  { key: 'invoices', icon: 'description', label: 'Invoices' },
  { key: 'appointments', icon: 'event', label: 'Appointments' },
]
const packagesStore = useCustomerPackagesStore()
const invoicesStore = useCustomerInvoicesStore()
const { isOpen: usageOpen, open: openUsage, close: closeUsage } = useOrderPackageUsageRoute()
const usageErrors = ref<Record<string, string>>({})
const blockedUsageOrders = ref(new Set<string>())
const usagePreview = ref<OrderCreditUsagePreview | null>(null)
const usagePreviewLoading = ref(false)
let latestUsagePreview = 0
const activePackages = computed(() => packagesStore.items.filter(
  (item) => item.status === 'ACTIVE' && item.customerId === props.customerId,
))
const actor = computed(() => {
  const raw = route.query.by
  return currentActor(Array.isArray(raw) ? raw[0] : raw)
})
const store = useCustomerOrderHistoryStore()
const { customer, orders, customerLoading, customerError } = storeToRefs(store)
const { openOrderId, open: openSheet, close: closeSheet } = useOrderSheetRoute()

const selectedOrder = computed(
  () => orders.value.find((order) => order.customerId === props.customerId
    && order.orderId?.trim() === openOrderId.value) ?? null,
)
const sheetOpen = computed(() => selectedOrder.value !== null)
const usageOrderKey = computed(() => JSON.stringify([props.customerId, openOrderId.value]))
const usageRetryBlocked = computed(() => blockedUsageOrders.value.has(usageOrderKey.value))
const usageError = computed(() => usageErrors.value[usageOrderKey.value] ?? packagesStore.error)
watch(usageOrderKey, () => { latestUsagePreview += 1; usagePreview.value = null; usagePreviewLoading.value = false })

function selectTab(tab: string) {
  router.replace({ name: 'customer-detail', params: { customerId: props.customerId, tab: resolveCustomerTab(tab) } })
}

function usePackage() {
  if (!selectedOrder.value || packagesStore.loading || !activePackages.value.length) return
  if (!usageRetryBlocked.value) delete usageErrors.value[usageOrderKey.value]
  openUsage()
}

async function loadUsagePreview(packageId: string) {
  delete usageErrors.value[usageOrderKey.value]
  usagePreview.value = null
  const requestId = ++latestUsagePreview
  if (!packageId || !selectedOrder.value) { usagePreviewLoading.value = false; return }
  usagePreviewLoading.value = true
  try {
    const preview = await getOrderCreditUsage(packageId, selectedOrder.value.orderId)
    if (requestId === latestUsagePreview) usagePreview.value = preview
  } catch (reason) {
    if (requestId === latestUsagePreview) usageErrors.value[usageOrderKey.value] = reason instanceof Error ? reason.message : 'Unable to calculate credits'
  } finally { if (requestId === latestUsagePreview) usagePreviewLoading.value = false }
}

async function submitUsage(value: { customerPackageId: string; manualCredits?: number }) {
  const order = selectedOrder.value
  if (!order || usageRetryBlocked.value || packagesStore.submittingUsage || packagesStore.loading) return
  const key = usageOrderKey.value
  if (!activePackages.value.some((item) => item.customerPackageId === value.customerPackageId)
    || usagePreview.value?.customerPackageId !== value.customerPackageId
    || (value.manualCredits ?? usagePreview.value.totalCredits) <= 0 || usagePreview.value.alreadyUsed) {
    usageErrors.value[key] = 'Select an eligible package and review positive order credits.'
    return
  }
  delete usageErrors.value[key]
  try {
    const result = await packagesStore.recordUsage(value.customerPackageId, order.orderId.trim(), actor.value, value.manualCredits)
    if (!result) return
    blockedUsageOrders.value.add(key)
    await packagesStore.load(props.customerId, true)
    if (usageOrderKey.value === key && activeTab.value === 'orders' && usageOpen.value) closeUsage()
    blockedUsageOrders.value.delete(key)
  } catch (reason) {
    blockedUsageOrders.value.add(key)
    usageErrors.value[key] = `Check package activity before retrying: ${reason instanceof Error ? reason.message : String(reason)}`
  }
}

function loadCustomer() {
  store.load(props.customerId)
}

function openOrder(orderId: string) {
  openSheet(orderId)
}

function bookDelivery() {
  const order = selectedOrder.value
  if (!customer.value || !order) return
  const orderId = order.orderId?.trim()
  if (!orderId || order.customerId !== customer.value.customerId) return
  router.push(appointmentCreateRoute({ customerId: customer.value.customerId, orderId }))
}

function createInvoice() {
  const order = selectedOrder.value
  if (!customer.value || !order) return
  const orderId = order.orderId?.trim()
  const customerId = customer.value.customerId.trim()
  if (!orderId || !customerId || order.customerId.trim() !== customerId) return
  router.push(invoiceCreateRoute({ customerId, orderId }))
}

onMounted(loadCustomer)
watch(() => props.customerId, loadCustomer)
watch([activeTab, () => props.customerId, openOrderId], ([tab, id, orderId]) => {
  if (tab === 'packages' || (tab === 'orders' && orderId)) void packagesStore.load(id)
  if (tab === 'invoices') void invoicesStore.load(id)
}, { immediate: true })
</script>

<template>
  <AppLayout>
    <ScrollRegion as="main" class="bg-surface pb-14">
      <p v-if="customerLoading" class="px-4 py-6 text-sm text-on-surface-variant">
        Loading customer...
      </p>
      <p v-else-if="customerError" class="px-4 py-4 text-sm text-error">
        Unable to load customer details.
      </p>

      <OrderHistoryCustomerCard v-if="customer" :customer="customer" />
      <OrderList v-if="activeTab === 'orders'" :customer-id="customerId" @select-order="openOrder" />
      <CustomerPackagesSection v-else-if="activeTab === 'packages'" :customer-id="customerId" />
      <CustomerInvoicesSection v-else-if="activeTab === 'invoices'" :customer-id="customerId" />
      <CustomerAppointmentsSection v-else :customer-id="customerId" />
    </ScrollRegion>

    <OrderDetailSheet
      v-if="activeTab === 'orders'"
      :open="sheetOpen && !usageOpen"
      :order="selectedOrder"
      :can-use-package="!packagesStore.loading && activePackages.length > 0"
      @close="closeSheet"
      @book-delivery="bookDelivery"
      @create-invoice="createInvoice"
      @use-package="usePackage"
    />
    <OrderPackageUsageOverlay
      v-if="activeTab === 'orders' && selectedOrder"
      :key="usageOrderKey"
      :open="usageOpen"
      :order-id="selectedOrder.orderId"
      :packages="activePackages"
      :loading="packagesStore.loading"
      :error="usageError"
      :submitting="packagesStore.submittingUsage"
      :retry-blocked="usageRetryBlocked"
      :preview="usagePreview"
      :preview-loading="usagePreviewLoading"
      @close="closeUsage"
      @select-package="loadUsagePreview"
      @submit="submitUsage"
    />
    <BottomNavBar :items="items" :active-key="activeTab" ariaLabel="Customer sections" @select="selectTab">
      <template #icon="{ item }"><CustomerSectionIcon :name="item.key" /></template>
    </BottomNavBar>
  </AppLayout>
</template>
