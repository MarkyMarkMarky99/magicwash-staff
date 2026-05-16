<script setup>
import { computed, ref, watch } from 'vue'
import { toDateStr } from '../../utils/gviz'
import FormInput from './shared/FormInput.vue'
import FormOptionGrid from './shared/FormOptionGrid.vue'
import FormTextarea from './shared/FormTextarea.vue'

const SERVICE_TYPES = [
  { value: 'WASH_FOLD',    label: 'Wash & Fold',  icon: 'local_laundry_service' },
  { value: 'WASH_IRON',    label: 'Wash & Iron',  icon: 'iron' },
  { value: 'DRY_CLEANING', label: 'Dry Cleaning', icon: 'dry_cleaning' },
  { value: 'PRESSING',     label: 'Pressing',     icon: 'checkroom' },
]

function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00`)
  d.setDate(d.getDate() + days)
  return toDateStr(d)
}

const pickupDate = ref(toDateStr(new Date()))
const dueDate    = ref(addDays(pickupDate.value, 3))
const orderName  = ref('')
const serviceType = ref('WASH_FOLD')
const notes      = ref('')

watch(pickupDate, (value) => {
  dueDate.value = addDays(value, 3)
})

const data = computed(() => ({
  pickupDate: pickupDate.value,
  dueDate: dueDate.value,
  orderName: orderName.value.trim(),
  serviceType: serviceType.value,
  notes: notes.value,
}))

const isValid = computed(() =>
  Boolean(pickupDate.value && dueDate.value && orderName.value.trim() && serviceType.value)
)

defineExpose({ data, isValid })
</script>

<template>
  <div class="px-6 py-5 space-y-5 pb-6">

    <!-- Dates -->
    <section class="grid grid-cols-2 gap-3">
      <FormInput
        id="order-pickup-date"
        v-model="pickupDate"
        type="date"
        label="วันที่รับ"
        icon="event"
      />

      <FormInput
        id="order-due-date"
        v-model="dueDate"
        type="date"
        label="กำหนดส่ง"
        icon="event_available"
      />
    </section>

    <!-- Order name -->
    <FormInput
      id="order-name"
      v-model="orderName"
      label="ชื่อออเดอร์"
      placeholder="เช่น Order A-1024"
      autocomplete="off"
      icon="sell"
    />

    <!-- Service type -->
    <FormOptionGrid
      v-model="serviceType"
      label="ประเภทบริการ"
      :options="SERVICE_TYPES"
    />

    <!-- Notes -->
    <FormTextarea
      id="order-notes"
      v-model="notes"
      label="โน๊ตหรือหมายเหตุเพิ่มเติม"
      placeholder="รายละเอียดเพิ่มเติมสำหรับออเดอร์นี้..."
      icon="edit_note"
    />

  </div>
</template>
