<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute, useRouter } from 'vue-router'
import { appendPackageTransactionRequestSchema } from '@contracts/customer-packages/customer-package-api.schema'
import AppLayout from '@/shared/layouts/AppLayout.vue'
import { useSelectedCustomerStore } from '@/shared/stores/selected-customer.store'
import { useDeliveryBookingIntentStore } from '@/shared/stores/delivery-booking-intent.store'
import { useInvoiceCreateIntentStore } from '@/shared/stores/invoice-create-intent.store'
import { useCustomerOrderHistoryStore } from '../stores/customer-order-history.store'
import { useOrderSheetRoute } from '@/features/customers/composables/useOrderSheetRoute'
import OrderDetailSheet from '../components/OrderDetailSheet.vue'
import OrderHistoryCustomerCard from '../components/OrderHistoryCustomerCard.vue'
import OrderList from '../components/OrderList.vue'
import GenericTabs from '@/shared/components/GenericTabs.vue'
import CustomerPackagesSection from '../components/CustomerPackagesSection.vue'
import CustomerInvoicesSection from '../components/CustomerInvoicesSection.vue'
import OrderPackageUsageOverlay from '../components/OrderPackageUsageOverlay.vue'
import { useCustomerPackagesStore } from '../stores/customer-packages.store'
import { useCustomerInvoicesStore } from '../stores/customer-invoices.store'
import { useOrderPackageUsageRoute } from '../composables/useOrderPackageUsageRoute'
import { resolveCustomerTab } from '../utils/customer-tab'
import CustomerPackageCreatePage from '@/features/customer-packages/pages/CustomerPackageCreatePage.vue'
import { useCustomerPackageBuyRoute } from '../composables/useCustomerPackageBuyRoute'
import { useCustomerPackagePurchaseStore } from '@/features/customer-packages/stores/customer-package-purchase.store'

const props = defineProps<{
  customerId: string
  tab?: string
}>()

const router = useRouter()
const route = useRoute()
const activeTab = computed(() => resolveCustomerTab(props.tab))
const tabs = [
  { key: 'orders', label: 'Orders' },
  { key: 'packages', label: 'Packages' },
  { key: 'invoices', label: 'Invoices' },
]
const packagesStore = useCustomerPackagesStore()
const invoicesStore = useCustomerInvoicesStore()
const purchaseStore = useCustomerPackagePurchaseStore()
const { isOpen: buyPackageOpen, open: openBuyPackage, close: closeBuyPackage } = useCustomerPackageBuyRoute()
const { isOpen: usageOpen, open: openUsage, close: closeUsage } = useOrderPackageUsageRoute()
const usageErrors = ref<Record<string, string>>({})
const blockedUsageOrders = ref(new Set<string>())
const activePackages = computed(() => packagesStore.items.filter(
  (item) => item.status === 'ACTIVE' && item.customerId === props.customerId,
))
const defaultStaff = computed(() => {
  const raw = route.query.by
  return (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? ''
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

function selectTab(tab: string) {
  router.replace({ name: 'customer-detail', params: { customerId: props.customerId, tab: resolveCustomerTab(tab) } })
}

function usePackage() {
  if (!selectedOrder.value || packagesStore.loading || !activePackages.value.length) return
  if (!usageRetryBlocked.value) delete usageErrors.value[usageOrderKey.value]
  openUsage()
}

async function submitUsage(value: { customerPackageId: string; creditsUsed: number; notes: string; createdBy: string }) {
  const order = selectedOrder.value
  if (!order || usageRetryBlocked.value || packagesStore.submittingUsage || packagesStore.loading) return
  const key = usageOrderKey.value
  if (!activePackages.value.some((item) => item.customerPackageId === value.customerPackageId)
    || !Number.isFinite(value.creditsUsed) || value.creditsUsed <= 0) {
    usageErrors.value[key] = 'Select an active package and enter a positive credit amount.'
    return
  }
  const parsed = appendPackageTransactionRequestSchema.safeParse({
    customerPackageId: value.customerPackageId, type: 'USAGE', creditChange: -value.creditsUsed,
    referenceSource: 'ORDER', referenceId: order.orderId.trim(),
    notes: value.notes.trim() || null, createdBy: value.createdBy.trim(),
  })
  if (!parsed.success) {
    usageErrors.value[key] = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join(', ')
    return
  }
  delete usageErrors.value[key]
  const result = await packagesStore.recordUsage(parsed.data)
  if (!result) return
  if (result.kind === 'created') {
    // Prevent a second submit while the balance is being refreshed.
    blockedUsageOrders.value.add(key)
    await packagesStore.load(props.customerId, true)
    if (usageOrderKey.value === key && activeTab.value === 'orders' && usageOpen.value) closeUsage()
    blockedUsageOrders.value.delete(key)
  } else if (result.kind === 'validation_error') {
    usageErrors.value[key] = result.issues.map((issue) => `${issue.path}: ${issue.message}`).join(', ')
  } else if (result.kind === 'transaction_write_failed' && result.certainty === 'unknown') {
    blockedUsageOrders.value.add(key)
    usageErrors.value[key] = 'This write may already have gone through. Retry is blocked. Verify package activity and reconcile the outcome before recording more usage for this order.'
  } else {
    usageErrors.value[key] = result.kind === 'package_not_found' ? 'Package was not found.' : result.message
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
  useSelectedCustomerStore().select(customer.value)
  useDeliveryBookingIntentStore().set(orderId)
  router.replace('/new-booking')
}

function createInvoice() {
  const order = selectedOrder.value
  if (!customer.value || !order) return
  const orderId = order.orderId?.trim()
  const customerId = customer.value.customerId.trim()
  if (!orderId || !customerId || order.customerId.trim() !== customerId) return
  useSelectedCustomerStore().select(customer.value)
  useInvoiceCreateIntentStore().set(order)
  router.replace({
    name: 'invoice-create',
    query: { customerId, orderId },
  })
}

onMounted(loadCustomer)
watch(() => purchaseStore.attempts[props.customerId]?.invoiceResult, (result) => {
  if (result?.kind === 'created') void invoicesStore.load(props.customerId, true)
})
watch(() => purchaseStore.attempts[props.customerId]?.packageResult, (result) => {
  if (result?.kind === 'created') void packagesStore.load(props.customerId, true)
})
watch(() => props.customerId, loadCustomer)
watch([activeTab, () => props.customerId, openOrderId], ([tab, id, orderId]) => {
  if (tab === 'packages' || (tab === 'orders' && orderId)) void packagesStore.load(id)
  if (tab === 'invoices') void invoicesStore.load(id)
}, { immediate: true })
</script>

<template>
  <AppLayout>
    <GenericTabs :tabs="tabs" :active-key="activeTab" @select="selectTab" />
    <main class="flex-1 overflow-y-auto no-scrollbar bg-surface pb-20">
      <p v-if="customerLoading" class="px-4 py-6 text-sm text-on-surface-variant">
        Loading customer...
      </p>
      <p v-else-if="customerError" class="px-4 py-4 text-sm text-error">
        Unable to load customer details.
      </p>

      <OrderHistoryCustomerCard v-if="customer" :customer="customer" />
      <OrderList v-if="activeTab === 'orders'" @select-order="openOrder" />
      <CustomerPackagesSection v-else-if="activeTab === 'packages'" :customer-id="customerId" @buy="openBuyPackage" />
      <CustomerInvoicesSection v-else :customer-id="customerId" />
    </main>

    <CustomerPackageCreatePage
      v-if="activeTab === 'packages' && buyPackageOpen"
      :key="customerId"
      :customer-id="customerId"
      :customer="customer"
      @close="closeBuyPackage"
    />
    <OrderDetailSheet
      v-if="activeTab === 'orders'"
      :open="sheetOpen"
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
      :default-staff="defaultStaff"
      :loading="packagesStore.loading"
      :error="usageError"
      :submitting="packagesStore.submittingUsage"
      :retry-blocked="usageRetryBlocked"
      @close="closeUsage"
      @submit="submitUsage"
    />
  </AppLayout>
</template>
