<script setup>
import { computed, onActivated, ref } from 'vue'
import { useRouter } from 'vue-router'
import FormActionButton from '../components/forms/shared/FormActionButton.vue'
import FormLayout from '../layouts/FormLayout.vue'
import {
  OrderItemsTable,
  PaymentSection,
  SummarySection,
} from '../components/payment'

const MOCK_ORDER = {
  orderId: 'ORD-2512-001',
  items: [
    { id: 1, name: 'เสื้อเชิ้ตแขนยาว', qty: 4, price: 35 },
    { id: 2, name: 'กางเกงขายาว', qty: 3, price: 35 },
    { id: 3, name: 'ผ้าปูที่นอน (King Size)', qty: 1, price: 120 },
  ],
  deliveryFee: 50,
  userCreditBalance: 120,
}

const router = useRouter()
const creditEnabled = ref(false)
const voucherInput = ref('')
const activeVoucher = ref(null)
const voucherMessage = ref('')
const voucherStatus = ref('idle')
const paymentMethod = ref('transfer')
const confirming = ref(false)
const error = ref('')

const subtotal = computed(() =>
  MOCK_ORDER.items.reduce((sum, item) => sum + (item.price * item.qty), 0)
)

const voucherDiscount = computed(() => {
  if (!activeVoucher.value) return 0
  return Math.min(activeVoucher.value.amount, subtotal.value + MOCK_ORDER.deliveryFee)
})

const creditUsed = computed(() => {
  if (!creditEnabled.value) return 0
  const totalAfterVoucher = subtotal.value + MOCK_ORDER.deliveryFee - voucherDiscount.value
  return Math.min(totalAfterVoucher, MOCK_ORDER.userCreditBalance)
})

const netTotal = computed(() =>
  Math.max(0, subtotal.value + MOCK_ORDER.deliveryFee - voucherDiscount.value - creditUsed.value)
)

const paymentMethodLabel = computed(() =>
  paymentMethod.value === 'cod' ? 'COD' : 'Transfer'
)

onActivated(() => {
  confirming.value = false
  error.value = ''
})

function formatCurrency(num) {
  return `฿${Number(num).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function applyVoucher(code) {
  const normalizedCode = code.trim().toUpperCase()
  error.value = ''

  if (!normalizedCode) {
    activeVoucher.value = null
    voucherMessage.value = ''
    voucherStatus.value = 'idle'
    return
  }

  if (normalizedCode === 'WELCOME') {
    activeVoucher.value = { code: 'WELCOME', amount: 50 }
    voucherMessage.value = 'Code Applied: -฿50'
    voucherStatus.value = 'success'
    voucherInput.value = normalizedCode
    return
  }

  if (normalizedCode === 'FREE') {
    activeVoucher.value = { code: 'FREE', amount: MOCK_ORDER.deliveryFee }
    voucherMessage.value = 'Code Applied: Free Shipping'
    voucherStatus.value = 'success'
    voucherInput.value = normalizedCode
    return
  }

  activeVoucher.value = null
  voucherMessage.value = 'Invalid Code'
  voucherStatus.value = 'error'
  voucherInput.value = normalizedCode
}

async function confirmOrder() {
  if (confirming.value) return

  confirming.value = true
  error.value = ''

  const payload = {
    orderId: MOCK_ORDER.orderId,
    items: MOCK_ORDER.items,
    summary: {
      subtotal: subtotal.value,
      delivery: MOCK_ORDER.deliveryFee,
      discount: voucherDiscount.value,
      creditUsed: creditUsed.value,
      netTotal: netTotal.value,
    },
    paymentMethod: paymentMethod.value,
    voucherCode: activeVoucher.value?.code || null,
  }

  try {
    console.log('SENDING TO API:', payload)
    await new Promise(resolve => setTimeout(resolve, 600))
  } catch (err) {
    error.value = err.message || 'Error creating order'
  } finally {
    confirming.value = false
  }
}
</script>

<template>
  <FormLayout title="Payment" @back="router.back()">
    <div class="px-4 py-4 space-y-4 pb-6 bg-surface">
      <OrderItemsTable
        :items="MOCK_ORDER.items"
        :format-currency="formatCurrency"
      />

      <SummarySection
        :subtotal="subtotal"
        :delivery="MOCK_ORDER.deliveryFee"
        :voucher-discount="voucherDiscount"
        :voucher-code="activeVoucher?.code || ''"
        :credit-used="creditUsed"
        :net-total="netTotal"
        :payment-method-label="paymentMethodLabel"
        :format-currency="formatCurrency"
      />

      <PaymentSection
        :credit-enabled="creditEnabled"
        :available-credit="MOCK_ORDER.userCreditBalance"
        :voucher-code="voucherInput"
        :voucher-message="voucherMessage"
        :voucher-status="voucherStatus"
        :payment-method="paymentMethod"
        :format-currency="formatCurrency"
        @update:credit-enabled="creditEnabled = $event"
        @update:voucher-code="voucherInput = $event"
        @apply-voucher="applyVoucher"
        @update:payment-method="paymentMethod = $event"
      />

      <div v-if="error" class="flex items-center gap-2 px-4 py-3 rounded-lg bg-error-container text-on-error-container text-sm font-body">
        <span class="material-symbols-outlined text-[18px] shrink-0">error</span>
        {{ error }}
      </div>
    </div>

    <template #footer>
      <div class="flex items-center gap-4">
        <div class="flex-1 min-w-0">
          <p class="text-[11px] text-on-surface-variant uppercase font-bold tracking-wide">Grand Total</p>
          <p class="text-xl font-headline font-extrabold text-on-surface">{{ formatCurrency(netTotal) }}</p>
        </div>
        <FormActionButton
          class="flex-none"
          :loading="confirming"
          loading-label="Processing"
          trailing-icon="arrow_forward"
          @click="confirmOrder"
        >
          Confirm Order
        </FormActionButton>
      </div>
    </template>
  </FormLayout>
</template>
