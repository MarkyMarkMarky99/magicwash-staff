<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import FormOverlay from '@/shared/layouts/FormOverlay.vue'
import FormInput from '@/shared/components/FormInput.vue'
import FormOptionGrid from '@/shared/components/FormOptionGrid.vue'
import FormTextarea from '@/shared/components/FormTextarea.vue'
import { useCloseRoute } from '@/shared/navigation/use-close-route'
import { getInvoiceDetail, type InvoiceDetailDto } from '@/data/invoices/invoice-detail.service'
import { reviewPayment } from '@/data/payments/payment.service'
import { normalizeSheetDate, todaySheetDate } from '@/shared/utils/sheet-date'

type ReviewAction = 'VERIFY' | 'REJECT'
type Payment = InvoiceDetailDto['payments'][number]

const actionOptions: Array<{ value: ReviewAction, label: string, icon: string }> = [
  { value: 'VERIFY', label: 'ยืนยันการชำระ', icon: 'task_alt' },
  { value: 'REJECT', label: 'ปฏิเสธ', icon: 'block' },
]

const router = useRouter()
const route = useRoute()
const invoiceNumber = singleQueryValue(route.query.invoiceNumber)
const paymentId = singleQueryValue(route.query.paymentId)
const fallback = invoiceNumber
  ? { name: 'invoice-detail', params: { invoiceNumber } }
  : { name: 'invoice-list' }
const { close } = useCloseRoute(fallback)

const invoice = ref<InvoiceDetailDto | null>(null)
const payment = ref<Payment | null>(null)
const loading = ref(true)
const submitting = ref(false)
const error = ref<string | null>(null)

const action = ref<ReviewAction>('VERIFY')
const amount = ref('')
const paidDate = ref(todaySheetDate())
const notes = ref('')

const amountValue = computed(() => {
  const parsed = Number(amount.value)
  return amount.value.trim() !== '' && Number.isFinite(parsed) ? parsed : null
})
const isValid = computed(() => action.value === 'VERIFY'
  ? amountValue.value !== null && amountValue.value !== 0 && paidDate.value !== ''
  : notes.value.trim() !== '')
const canSubmit = computed(() => Boolean(payment.value && isValid.value && !submitting.value))
const submitLabel = computed(() => action.value === 'VERIFY' ? 'ยืนยันการชำระ' : 'ปฏิเสธการชำระ')
const title = computed(() => invoice.value?.invoiceNumber ?? invoiceNumber ?? 'Invoice')
const helperText = computed(() => {
  if (!invoice.value) return undefined
  const customerName = invoice.value.customer.customerName?.trim()
  const balance = `ยอดค้าง ${formatMoney(invoice.value.balanceDue)}`
  return customerName ? `${customerName} · ${balance}` : balance
})
const proofUrl = computed(() => safeHttpUrl(payment.value?.proofUrl ?? null))

onMounted(async () => {
  if (!invoiceNumber || !paymentId) {
    error.value = 'ไม่พบรายการชำระที่ต้องตรวจสอบ'
    loading.value = false
    return
  }

  try {
    const result = await getInvoiceDetail(invoiceNumber)
    const found = result?.payments.find((item) => item.paymentId === paymentId) ?? null
    if (!result || !found) {
      error.value = 'ไม่พบรายการชำระนี้'
      return
    }
    if (found.status !== 'PENDING') {
      error.value = 'รายการนี้ถูกตรวจสอบไปแล้ว'
      return
    }
    invoice.value = result
    payment.value = found
    const initialAmount = found.amount ?? (result.balanceDue > 0 ? result.balanceDue : null)
    if (initialAmount !== null) amount.value = String(initialAmount)
    paidDate.value = normalizeSheetDate(found.paidAt) ?? todaySheetDate()
  } catch {
    error.value = 'โหลดใบแจ้งหนี้ไม่สำเร็จ'
  } finally {
    loading.value = false
  }
})

function singleQueryValue(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  return normalized || null
}

function safeHttpUrl(value: string | null) {
  if (!value?.trim()) return null
  try {
    const url = new URL(value.trim())
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null
  } catch {
    return null
  }
}

function formatMoney(value: number) {
  return `฿${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// Today is left to the server so the row keeps the actual time of review;
// an earlier date records the start of that day.
function createPaidAt(): string | undefined {
  return paidDate.value === todaySheetDate() ? undefined : `${paidDate.value} 00:00:00`
}

function returnAfterSave() {
  if (window.history.state?.back) {
    router.back()
    return
  }
  void router.replace(fallback)
}

async function submit() {
  if (!canSubmit.value || !payment.value?.paymentId) return

  submitting.value = true
  error.value = null
  try {
    const note = notes.value.trim()
    if (action.value === 'VERIFY') {
      if (amountValue.value === null) return
      await reviewPayment(payment.value.paymentId, {
        action: 'VERIFY',
        amount: amountValue.value,
        paidAt: createPaidAt(),
        notes: note || undefined,
      })
    } else {
      await reviewPayment(payment.value.paymentId, { action: 'REJECT', notes: note })
    }
    returnAfterSave()
  } catch (reason) {
    error.value = reason instanceof Error && reason.message
      ? reason.message
      : 'บันทึกผลการตรวจสอบไม่สำเร็จ'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <FormOverlay
    :open="true"
    eyebrow="REVIEW PAYMENT"
    :title="title"
    :helper-text="helperText"
    :submit-label="submitLabel"
    :is-submitting="submitting"
    :is-submit-disabled="!canSubmit"
    :close-on-backdrop="false"
    @close="close"
    @submit="submit"
  >
    <p v-if="loading" class="px-4 py-6 text-sm text-on-surface-variant">กำลังโหลด...</p>

    <div v-else-if="payment" class="space-y-4 pb-6">
      <a
        v-if="proofUrl"
        :href="proofUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="block overflow-hidden rounded-xl border border-outline-variant/40 bg-surface-variant"
      >
        <img :src="proofUrl" alt="สลิปที่ลูกค้าแนบ" class="max-h-72 w-full object-contain" />
      </a>
      <p v-else class="rounded-xl bg-surface-variant px-3 py-4 text-center text-sm text-on-surface-variant">ไม่มีรูปสลิปแนบ</p>

      <p v-if="payment.notes" class="rounded-lg bg-surface-container px-3 py-2 font-body text-xs text-on-surface-variant">
        หมายเหตุเดิม: {{ payment.notes }}
      </p>

      <FormOptionGrid v-model="action" label="ผลการตรวจสอบ *" :options="actionOptions" variant="compact" />

      <template v-if="action === 'VERIFY'">
        <FormInput
          id="review-amount"
          v-model="amount"
          label="จำนวนเงินตามสลิป (บาท) *"
          type="number"
          inputmode="decimal"
          step="0.01"
          placeholder="0.00"
        />
        <FormInput id="review-date" v-model="paidDate" label="วันที่ชำระ *" type="date" :max="todaySheetDate()" />
        <FormTextarea id="review-notes" v-model="notes" label="หมายเหตุ" placeholder="ไม่บังคับ" />
      </template>

      <FormTextarea
        v-else
        id="review-reject-notes"
        v-model="notes"
        label="เหตุผลที่ปฏิเสธ *"
        placeholder="เช่น ยอดในสลิปไม่ตรง, สลิปซ้ำ"
      />
    </div>

    <div v-if="error" class="mb-6 flex items-center gap-2 rounded-xl bg-error-container px-4 py-3 font-body text-sm text-on-error-container" role="alert">
      <span class="material-symbols-outlined shrink-0 text-[18px]" aria-hidden="true">error</span>{{ error }}
    </div>
  </FormOverlay>
</template>
