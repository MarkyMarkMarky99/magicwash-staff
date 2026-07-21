import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import {
  getCustomerById,
  type CustomerDetailDto,
} from '../services/customer.service'
import {
  listOrdersByCustomer,
  type OrderListDto,
} from '../services/order.service'
import {
  listAppointmentsByCustomer,
  type AppointmentListDto,
} from '../services/waiting-pickup.service'
import { filterWaitingPickups } from '../utils/waiting-pickup.filter'

export const useCustomerOrderHistoryStore = defineStore('customer-order-history', () => {
  const customer = ref<CustomerDetailDto | null>(null)
  const orders = ref<OrderListDto[]>([])
  const appointments = ref<AppointmentListDto[]>([])

  const customerLoading = ref(false)
  const ordersLoading = ref(false)
  const appointmentsLoading = ref(false)
  const customerError = ref<string | null>(null)
  const ordersError = ref<string | null>(null)
  const appointmentsError = ref<string | null>(null)

  const waitingPickups = computed(() => filterWaitingPickups(appointments.value))

  let activeCustomerId: string | null = null
  let loadedCustomerId: string | null = null

  async function load(customerId: string, force = false) {
    if (!force && loadedCustomerId === customerId) {
      return
    }

    activeCustomerId = customerId
    loadedCustomerId = null
    customer.value = null
    orders.value = []
    appointments.value = []
    customerError.value = null
    ordersError.value = null
    appointmentsError.value = null
    customerLoading.value = true
    ordersLoading.value = true
    appointmentsLoading.value = true

    const results = await Promise.allSettled([
      getCustomerById(customerId),
      listOrdersByCustomer(customerId),
      listAppointmentsByCustomer(customerId),
    ])

    const [customerResult, ordersResult, appointmentsResult] = results

    if (customerResult.status === 'fulfilled') {
      customer.value = customerResult.value
    } else {
      customerError.value = 'Unable to load customer'
    }

    if (ordersResult.status === 'fulfilled') {
      orders.value = ordersResult.value
    } else {
      ordersError.value = 'Unable to load order history'
    }

    if (appointmentsResult.status === 'fulfilled') {
      appointments.value = appointmentsResult.value
    } else {
      appointmentsError.value = 'Unable to load waiting pickups'
    }

    customerLoading.value = false
    ordersLoading.value = false
    appointmentsLoading.value = false
    if (activeCustomerId === customerId) {
      loadedCustomerId = customerId
    }
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
