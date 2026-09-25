<script setup lang="ts">
import { serviceTypeOptions } from '@/shared/utils/service-type-labels'
import { computed, onMounted, reactive, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute, useRouter } from 'vue-router'
import { workOrderCreateSchema, workOrderStatusSchema } from '@contracts/work-orders/work-order-api.schema'
import FormInput from '@/shared/components/FormInput.vue'
import FormOptionGrid from '@/shared/components/FormOptionGrid.vue'
import FormPicker from '@/shared/components/FormPicker.vue'
import FormTextarea from '@/shared/components/FormTextarea.vue'
import FormOverlay from '@/shared/layouts/FormOverlay.vue'
import { useCloseRoute } from '@/shared/navigation/use-close-route'
import { currentActor } from '@/shared/config/actor'
import { normalizeSheetDate, todaySheetDate } from '@/shared/utils/sheet-date'
import { ORDER_EDIT_ROUTE_NAME } from '@/shared/navigation/form-routes'
import { getWorkOrder, type WorkOrderDetailDto, type WorkOrderUpdatePayload } from '@/data/work-orders/work-order.service'
import { useWorkOrderStore } from '@/data/work-orders/work-order.store'
import { useCustomerOrdersStore } from '@/data/orders/order.store'
import { presentationFor } from '@/features/orders/order-status-presentation'
import { orderQuantityMismatch } from '@/features/orders/order-quantity-mismatch'
import { useOrderStore } from '@/features/orders/stores/order.store'
import { useCustomerStore } from '@/data/customers/customer.store'
import { getCustomerById, type CustomerDetailDto } from '@/data/customers/customer.service'
import { formatCustomerLabel } from '@/shared/utils/customer-label'

defineOptions({ name: 'OrderCreatePage' })

const router = useRouter()
const route = useRoute()
const isEdit = route.name === ORDER_EDIT_ROUTE_NAME
const editOrderId = isEdit ? singleQueryValue(route.params.orderId) : null
const sourceCustomerId = singleQueryValue(route.query.customerId)
const hasCustomerQuery = route.query.customerId !== undefined
const { close: closeRoute } = useCloseRoute({ name: 'order-list' })
const orderStore = useOrderStore()
const workOrderStore = useWorkOrderStore()
const customerOrdersStore = useCustomerOrdersStore()
const customerStore = useCustomerStore()
const {
  customers,
  loading: customersLoading,
  error: customersError,
  truncated: customersTruncated,
} = storeToRefs(customerStore)
const submitted = ref(false)
const submitting = ref(false)
const formError = ref<string | null>(null)
const lockedCustomer = ref<CustomerDetailDto | null>(null)
const loadedOrder = ref<WorkOrderDetailDto | null>(null)
const initializing = ref(isEdit)
// Intake is nearly always logged on the day the laundry arrives, so the received
// date defaults to today in Bangkok; the due date stays for staff to choose.
function blankForm() { return { customerId: '', receivedDate: todaySheetDate(), dueDate: '', serviceType: '', status: '', quantity: '', note: '', orderName: '' } }
const form = reactive(blankForm())
const serviceOptions = serviceTypeOptions
const statusOptions = workOrderStatusSchema.options.map((value) => ({ value, label: presentationFor(value).label }))
const customerOptions = computed(() => (lockedCustomer.value ? [lockedCustomer.value] : customers.value).map((customer) => ({
  value: customer.customerId,
  label: customer.customerName,
  description: [customer.customerIndex, customer.phone, customer.location].filter(Boolean).join(' • ') || undefined,
  disabled: Boolean(sourceCustomerId),
})))
const editCustomerLabel = computed(() => {
  const customer = customers.value.find((entry) => entry.customerId === form.customerId)
  return customer ? formatCustomerLabel(customer.customerName, customer.customerIndex) : form.customerId
})
const datesOutOfOrder = computed(() => Boolean(form.receivedDate && form.dueDate && form.receivedDate > form.dueDate))
const quantityInvalid = computed(() => form.quantity !== '' && !/^\d+$/.test(form.quantity))
const approvalQuantityMismatch = computed(() => form.status === 'APPROVED' && loadedOrder.value !== null && loadedOrder.value.status !== 'APPROVED' && orderQuantityMismatch(
  form.quantity === '' ? null : Number(form.quantity), loadedOrder.value.items,
))
const updatePayload = computed<WorkOrderUpdatePayload>(() => {
  const source = loadedOrder.value
  if (!source) return {}
  const payload: WorkOrderUpdatePayload = {}
  if (form.status && form.status !== source.status) payload.status = workOrderStatusSchema.parse(form.status)
  if (form.receivedDate !== normalizeSheetDate(source.receivedDate)) payload.receivedDate = form.receivedDate
  if (form.dueDate !== normalizeSheetDate(source.dueDate)) payload.dueDate = form.dueDate
  const quantity = form.quantity === '' ? null : Number(form.quantity)
  if (quantity !== source.quantity) payload.quantity = quantity
  return payload
})
const invalid = computed(() => isEdit
  ? !loadedOrder.value || !form.receivedDate || !form.dueDate || datesOutOfOrder.value || quantityInvalid.value || approvalQuantityMismatch.value || Object.keys(updatePayload.value).length === 0
  : !form.customerId || !form.receivedDate || !form.dueDate || !form.serviceType || datesOutOfOrder.value || quantityInvalid.value)
const dateError = computed(() => submitted.value && (!form.receivedDate || !form.dueDate || datesOutOfOrder.value))

function resetForm() { Object.assign(form, blankForm()); submitted.value = false; formError.value = null }
function close() {
  if (submitting.value) return
  closeRoute()
}
function singleQueryValue(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  return normalized || null
}
async function submit() {
  if (submitting.value) return
  submitted.value = true
  formError.value = null
  if (invalid.value) return
  submitting.value = true
  try {
    if (isEdit && editOrderId) {
      const updated = await workOrderStore.update(editOrderId, updatePayload.value)
      customerOrdersStore.applyPersisted(updated)
      if (updatePayload.value.status === 'APPROVED') {
        const tickets = updated.ticketProvisioning
        const result = tickets.failure
          ? tickets.failure.certainty === 'unknown'
            ? 'Ticket creation could not be confirmed. Check tickets before retrying.'
            : 'Ticket creation failed.'
          : 'Ticket creation completed.'
        await router.replace({
          name: 'order-detail',
          params: { orderId: updated.orderId },
          state: {
            orderApprovalNotice: {
              orderId: updated.orderId,
              message: `Order saved. ${tickets.ticketsCreated} tickets created. ${result}`,
              success: !tickets.failure,
            },
          },
        })
        return
      }
      await router.replace({ name: 'order-detail', params: { orderId: updated.orderId } })
      return
    }
    const created = await orderStore.create(workOrderCreateSchema.parse({
      customerId: form.customerId,
      receivedDate: form.receivedDate,
      dueDate: form.dueDate,
      serviceType: form.serviceType,
      quantity: form.quantity === '' ? null : Number(form.quantity),
      note: form.note.trim() || null,
      orderName: form.orderName.trim() || null,
      createdBy: currentActor(),
      items: [],
    }))
    await router.replace({ name: 'order-detail', params: { orderId: created.orderId } })
  } catch (reason) {
    formError.value = reason instanceof Error ? reason.message : isEdit ? 'Unable to save work order' : 'Unable to create work order'
  } finally { submitting.value = false }
}
onMounted(async () => {
  resetForm()
  if (isEdit) {
    if (!editOrderId) {
      formError.value = 'The order id is invalid.'
      initializing.value = false
      return
    }
    try {
      const order = await getWorkOrder(editOrderId)
      loadedOrder.value = order
      form.customerId = order.customerId
      form.receivedDate = normalizeSheetDate(order.receivedDate) ?? ''
      form.dueDate = normalizeSheetDate(order.dueDate) ?? ''
      form.serviceType = order.serviceType ?? ''
      form.status = order.status ?? ''
      form.quantity = order.quantity == null ? '' : String(order.quantity)
      form.note = order.note ?? ''
      form.orderName = order.orderName ?? ''
    } catch (reason) {
      formError.value = reason instanceof Error ? reason.message : 'Unable to load the order.'
    } finally {
      initializing.value = false
    }
    return
  }
  if (hasCustomerQuery && (!sourceCustomerId || route.query.customerId !== sourceCustomerId)) {
    formError.value = 'The customer id is invalid.'
    return
  }
  if (sourceCustomerId) {
    try {
      lockedCustomer.value = await getCustomerById(sourceCustomerId)
      form.customerId = lockedCustomer.value.customerId
    } catch (reason) {
      formError.value = reason instanceof Error && reason.message
        ? reason.message
        : 'Unable to load the customer.'
    }
    return
  }
  void customerStore.loadCustomers()
})
</script>

<template>
  <FormOverlay open :title="isEdit ? 'แก้ไขออเดอร์' : 'สร้างออเดอร์'" :eyebrow="isEdit ? 'Edit laundry intake' : 'New laundry intake'" :helper-text="isEdit ? 'แก้ไขสถานะ วันที่ และจำนวนของออเดอร์' : 'บันทึกข้อมูลรับผ้าให้ครบก่อนเพิ่มรายการสินค้าและรูปภาพ'" :submit-label="isEdit ? 'บันทึกออเดอร์' : 'สร้างออเดอร์'" :is-submitting="submitting" :is-submit-disabled="isEdit && (initializing || invalid)" @close="close" @submit="submit">
    <div class="space-y-5 pb-5"><p v-if="approvalQuantityMismatch" role="alert" class="rounded-xl border border-error/20 bg-error-container/30 px-3 py-2 font-body text-sm text-on-error-container">Order quantity must match the sum of item quantities before approval.</p><div v-if="submitted && invalid" class="rounded-xl border border-error/20 bg-error-container/30 px-3 py-2 font-body text-sm text-on-error-container">กรุณาเลือกลูกค้า ระบุวันที่รับผ้า กำหนดส่ง และบริการ</div><div v-if="formError" class="rounded-xl border border-error/20 bg-error-container/30 px-3 py-2 font-body text-sm text-on-error-container">{{ formError }}</div><p v-if="isEdit" class="font-body text-sm text-on-surface-variant">ลูกค้า: {{ editCustomerLabel }}</p><FormPicker v-else id="order-customer" v-model="form.customerId" label="ลูกค้า *" :options="customerOptions" placeholder="เลือกลูกค้า" search-placeholder="ค้นหาลูกค้า" :loading="customersLoading" :error="customersError ?? ''" empty-text="ไม่พบลูกค้า"/><p v-if="!isEdit && customersTruncated" role="status" class="-mt-3 text-xs text-amber-800">รายชื่อลูกค้าอาจไม่ครบ เนื่องจากมีมากกว่า 2,000 รายการ</p><div class="grid grid-cols-2 gap-3"><FormInput id="order-received-date" v-model="form.receivedDate" label="วันที่รับผ้า *" type="date"/><FormInput id="order-due-date" v-model="form.dueDate" label="กำหนดส่ง *" type="date"/></div><p v-if="dateError" class="-mt-3 text-xs text-error">{{ datesOutOfOrder ? 'วันที่รับผ้าต้องไม่เกินกำหนดส่ง' : 'กรุณาระบุวันที่รับผ้าและกำหนดส่ง' }}</p><FormPicker v-if="isEdit" id="order-status" v-model="form.status" label="สถานะ" :options="statusOptions" :searchable="false"/><FormOptionGrid v-else v-model="form.serviceType" label="บริการ *" :options="serviceOptions"/><section class="rounded-xl border border-outline-variant/25 bg-surface-container-low p-3"><p class="mb-3 font-label text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">รายละเอียดรับผ้า</p><FormInput id="order-quantity" v-model="form.quantity" label="จำนวน" type="number" min="0" placeholder="0"/><p v-if="submitted && quantityInvalid" class="mt-2 text-xs text-error">จำนวนต้องเป็นจำนวนเต็ม</p></section><FormInput v-if="!isEdit" id="order-name" v-model="form.orderName" label="ชื่อออเดอร์" placeholder="เช่น ผ้ารับวันที่ 30 ส.ค."/><FormTextarea v-if="!isEdit" id="order-note" v-model="form.note" label="หมายเหตุ" placeholder="ข้อสังเกตสำหรับทีมซักรีด"/></div>
  </FormOverlay>
</template>
