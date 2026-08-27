<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import BaseOverlay from '@/shared/layouts/BaseOverlay.vue'
import type { CustomerListDto } from '@/features/customers/services/customer.service'

const props = defineProps<{
  modelValue: string
  customers: CustomerListDto[]
  loading: boolean
  error: string | null
}>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const open = ref(false)
const searchInput = ref('')
const search = ref('')
let debounceTimer: ReturnType<typeof setTimeout> | undefined

const selectedCustomer = computed(() => props.customers.find((customer) => customer.customerId === props.modelValue) ?? null)
const filteredCustomers = computed(() => {
  const query = search.value.trim().toLocaleLowerCase('th-TH')
  if (!query) return props.customers
  return props.customers.filter((customer) => [customer.customerName, customer.phone ?? '']
    .some((value) => value.toLocaleLowerCase('th-TH').includes(query)))
})

watch(searchInput, (value) => {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => { search.value = value }, 250)
})

function showPicker() { open.value = true }
function closePicker() { open.value = false }
function selectCustomer(customerId: string) { emit('update:modelValue', customerId); closePicker() }
onBeforeUnmount(() => clearTimeout(debounceTimer))
</script>

<template>
  <section>
    <label for="customer-package-customer" class="mb-1.5 block font-label text-xs text-on-surface-variant">ลูกค้า *</label>
    <button id="customer-package-customer" type="button" class="flex min-h-12 w-full items-center justify-between rounded-xl border border-outline-variant/30 bg-surface-container px-3 text-left font-body text-sm" @click="showPicker">
      <span class="truncate" :class="selectedCustomer ? 'text-on-surface' : 'text-on-surface-variant'">{{ selectedCustomer ? `${selectedCustomer.customerName}${selectedCustomer.phone ? ` · ${selectedCustomer.phone}` : ''}` : 'เลือกลูกค้า' }}</span>
      <span class="material-symbols-outlined text-on-surface-variant" aria-hidden="true">search</span>
    </button>
  </section>

  <BaseOverlay :open="open" variant="full" aria-label="เลือกลูกค้า" @close="closePicker">
    <div class="min-h-full bg-surface p-4">
      <div class="mb-4 flex items-center justify-between"><h2 class="font-headline text-lg font-bold">เลือกลูกค้า</h2><button type="button" class="material-symbols-outlined" aria-label="ปิด" @click="closePicker">close</button></div>
      <label class="sr-only" for="customer-picker-search">ค้นหาลูกค้า</label>
      <input id="customer-picker-search" v-model="searchInput" autofocus class="mb-3 w-full rounded-xl bg-surface-container px-3 py-3 font-body text-sm outline-none" placeholder="ค้นหาชื่อหรือเบอร์โทร">
      <p v-if="loading" class="font-body text-sm text-on-surface-variant">กำลังโหลดลูกค้า...</p>
      <p v-else-if="error" class="font-body text-sm text-error">{{ error }}</p>
      <p v-else-if="filteredCustomers.length === 0" class="font-body text-sm text-on-surface-variant">ไม่พบลูกค้า</p>
      <div v-else class="divide-y divide-outline-variant/20 rounded-xl bg-surface-container-low">
        <button v-for="customer in filteredCustomers" :key="customer.customerId" type="button" class="block w-full px-4 py-3 text-left" @click="selectCustomer(customer.customerId)">
          <strong class="block font-body text-sm text-on-surface">{{ customer.customerName }}</strong>
          <span class="font-body text-xs text-on-surface-variant">{{ customer.phone ?? 'ไม่มีเบอร์โทร' }}</span>
        </button>
      </div>
    </div>
  </BaseOverlay>
</template>
