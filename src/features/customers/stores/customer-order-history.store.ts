import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import {
  getCustomerById,
  type CustomerDetailDto,
} from '@/data/customers/customer.service'
import {
  type OrderListDto,
} from '@/data/orders/order.service'
import { useCustomerOrdersStore } from '@/data/orders/order.store'
import type { AppointmentListDto } from '@/data/appointments/waiting-pickup.service'
import { useCustomerAppointmentsStore } from '@/data/appointments/customer-appointments.store'
import { filterWaitingPickups } from '../utils/waiting-pickup.filter'

export const useCustomerOrderHistoryStore = defineStore('customer-order-history', () => {
  const customer = ref<CustomerDetailDto | null>(null)
  const customerOrdersStore = useCustomerOrdersStore()
  const customerAppointmentsStore = useCustomerAppointmentsStore()
  const orders = computed<OrderListDto[]>(() => customerOrdersStore.items)
  const appointments = computed<AppointmentListDto[]>(() => customerAppointmentsStore.items)

  const customerLoading = ref(false)
  const ordersLoading = computed(() => customerOrdersStore.loading)
  const appointmentsLoading = computed(() => customerAppointmentsStore.loading)
  const customerError = ref<string | null>(null)
  const ordersError = computed(() => customerOrdersStore.error)
  const appointmentsError = computed(() => customerAppointmentsStore.error)

  const waitingPickups = computed(() => filterWaitingPickups(appointments.value))

  let activeCustomerId: string | null = null
  let loadedCustomerId: string | null = null
  let requestId = 0

  async function load(customerId: string, force = false) {
    if (!force && loadedCustomerId === customerId) {
      return
    }

    const id = ++requestId
    activeCustomerId = customerId
    loadedCustomerId = null
    customer.value = null
    customerError.value = null
    customerLoading.value = true

    const results = await Promise.allSettled([
      getCustomerById(customerId),
      customerOrdersStore.load(customerId, force),
      customerAppointmentsStore.load(customerId, force),
    ])

    if (id !== requestId || activeCustomerId !== customerId) return

    const [customerResult] = results

    if (customerResult.status === 'fulfilled') {
      customer.value = customerResult.value
    } else {
      customerError.value = 'Unable to load customer'
    }

    customerLoading.value = false
    loadedCustomerId = customerId
  }

  async function refresh() {
    if (activeCustomerId !== null) {
      await load(activeCustomerId, true)
    }
  }

  return {
    customer,
    orders,
    appointments,
    customerLoading,
    ordersLoading,
    appointmentsLoading,
    customerError,
    ordersError,
    appointmentsError,
    waitingPickups,
    load,
    refresh,
  }
})
