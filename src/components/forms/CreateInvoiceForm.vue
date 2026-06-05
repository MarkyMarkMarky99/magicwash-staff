<script setup>
import { computed, ref } from 'vue'
import { toDateStr } from '../../utils/gviz'
import FormInput from './shared/FormInput.vue'
import FormOptionGrid from './shared/FormOptionGrid.vue'
import FormTextarea from './shared/FormTextarea.vue'

const PAYMENT_METHODS = [
  { value: 'TRANSFER', label: 'Transfer', icon: 'account_balance' },
  { value: 'COD', label: 'COD', icon: 'payments' },
  { value: 'CREDIT', label: 'Credit', icon: 'credit_score' },
]

function addDays(days) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return toDateStr(date)
}

const customerName = ref('')
const invoiceNo = ref(`INV-${new Date().getFullYear()}-`)
const dueDate = ref(addDays(7))
const paymentMethod = ref('TRANSFER')
const notes = ref('')

const data = computed(() => ({
  customerName: customerName.value.trim(),
  invoiceNo: invoiceNo.value.trim(),
  dueDate: dueDate.value,
  paymentMethod: paymentMethod.value,
  notes: notes.value.trim(),
}))

const isValid = computed(() =>
  Boolean(customerName.value.trim() && invoiceNo.value.trim() && dueDate.value && paymentMethod.value)
)

defineExpose({ data, isValid })
</script>

<template>
  <div class="px-6 py-5 space-y-5 pb-6">
    <FormInput
      id="invoice-customer"
      v-model="customerName"
      label="Customer"
      placeholder="Customer name"
      autocomplete="off"
      icon="person"
    />

    <section class="grid grid-cols-2 gap-3">
      <FormInput
        id="invoice-number"
        v-model="invoiceNo"
        label="Invoice No."
        placeholder="INV-2026-0001"
        autocomplete="off"
        icon="tag"
      />

      <FormInput
        id="invoice-due-date"
        v-model="dueDate"
        type="date"
        label="Due Date"
        icon="event_available"
      />
    </section>

    <FormOptionGrid
      v-model="paymentMethod"
      label="Payment Method"
      :options="PAYMENT_METHODS"
    />

    <FormTextarea
      id="invoice-notes"
      v-model="notes"
      label="Notes"
      placeholder="Invoice notes..."
      icon="edit_note"
    />
  </div>
</template>
