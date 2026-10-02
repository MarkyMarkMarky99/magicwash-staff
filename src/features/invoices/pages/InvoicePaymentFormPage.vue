<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import FormOverlay from '@/shared/layouts/FormOverlay.vue'
import FormInput from '@/shared/components/FormInput.vue'
import FormLabel from '@/shared/components/FormLabel.vue'
import FormOptionGrid from '@/shared/components/FormOptionGrid.vue'
import FormTextarea from '@/shared/components/FormTextarea.vue'
import { useCloseRoute } from '@/shared/navigation/use-close-route'
import { getInvoiceDetail, type InvoiceDetailDto } from '@/data/invoices/invoice-detail.service'
import { createPayment, type CreatePaymentRequest } from '@/data/payments/payment.service'
import { uploadToStorage } from '@/shared/api/firebase-storage'
import { compressImage } from '@/utils/imageCompression'
import { todaySheetDate } from '@/shared/utils/sheet-date'

const PROOF_FOLDER = 'payment-proofs'

type PaymentMethod = CreatePaymentRequest['method']

const methodOptions: Array<{ value: PaymentMethod, label: string, icon: string }> = [
  { value: 'CASH', label: 'เงินสด', icon: 'payments' },
  { value: 'BANK_TRANSFER', label: 'โอนเงิน', icon: 'account_balance' },
  { value: 'QR_PROMPTPAY', label: 'พร้อมเพย์', icon: 'qr_code_2' },
  { value: 'CREDIT_CARD', label: 'บัตรเครดิต', icon: 'credit_card' },
  { value: 'GIFT_VOUCHER', label: 'บัตรกำนัล', icon: 'redeem' },
  { value: 'OTHER', label: 'อื่น ๆ', icon: 'more_horiz' },
]

const router = useRouter()
const route = useRoute()
const invoiceNumber = singleQueryValue(route.query.invoiceNumber)
const fallback = invoiceNumber
  ? { name: 'invoice-detail', params: { invoiceNumber } }
  : { name: 'invoice-list' }
const { close } = useCloseRoute(fallback)

const invoice = ref<InvoiceDetailDto | null>(null)
const loading = ref(true)
const submitting = ref(false)
const error = ref<string | null>(null)

const amount = ref('')
const method = ref<PaymentMethod | null>(null)
const paidDate = ref(todaySheetDate())
const reference = ref('')
const notes = ref('')
const proofFile = ref<File | null>(null)
const proofPreviewUrl = ref<string | null>(null)
const proofInput = ref<HTMLInputElement | null>(null)

const amountValue = computed(() => {
  const parsed = Number(amount.value)
  return amount.value.trim() !== '' && Number.isFinite(parsed) ? parsed : null
})
const isValid = computed(() =>
  amountValue.value !== null && amountValue.value !== 0 && method.value !== null && paidDate.value !== '',
)
const canSubmit = computed(() => Boolean(invoice.value && isValid.value && !submitting.value))
const title = computed(() => invoice.value?.invoiceNumber ?? invoiceNumber ?? 'Invoice')
const helperText = computed(() => {
  if (!invoice.value) return undefined
  const customerName = invoice.value.customer.customerName?.trim()
  const balance = `ยอดค้าง ${formatMoney(invoice.value.balanceDue)}`
  return customerName ? `${customerName} · ${balance}` : balance
})

onMounted(async () => {
  if (!invoiceNumber || route.query.invoiceNumber !== invoiceNumber) {
    error.value = 'ไม่พบเลขที่ใบแจ้งหนี้'
    loading.value = false
    return
  }

  try {
    const result = await getInvoiceDetail(invoiceNumber)
    if (!result) {
      error.value = 'ไม่พบใบแจ้งหนี้นี้'
      return
    }
    invoice.value = result
    if (result.balanceDue > 0) amount.value = String(result.balanceDue)
  } catch {
    error.value = 'โหลดใบแจ้งหนี้ไม่สำเร็จ'
  } finally {
    loading.value = false
  }
})

onBeforeUnmount(releasePreview)

function singleQueryValue(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  return normalized || null
}

function formatMoney(value: number) {
  return `฿${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function optionalText(value: string): string | undefined {
  const trimmed = value.trim()
  return trimmed || undefined
}

function releasePreview() {
  if (proofPreviewUrl.value) URL.revokeObjectURL(proofPreviewUrl.value)
  proofPreviewUrl.value = null
}

function pickProof() {
  proofInput.value?.click()
}

function handleProofPick(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  releasePreview()
  proofFile.value = file
  proofPreviewUrl.value = URL.createObjectURL(file)
}

function clearProof() {
  releasePreview()
  proofFile.value = null
}

// Today is left to the server so the row keeps the actual time of entry;
// a backdated payment records the start of that day.
function createPaidAt(): string | undefined {
  return paidDate.value === todaySheetDate() ? undefined : `${paidDate.value} 00:00:00`
}

async function uploadProof(): Promise<string | undefined> {
  if (!proofFile.value) return undefined
  const compressed = await compressImage(proofFile.value)
  return uploadToStorage(compressed, PROOF_FOLDER)
}

function returnAfterSave() {
  if (window.history.state?.back) {
    router.back()
    return
  }
  void router.replace(fallback)
}

async function submit() {
  if (!canSubmit.value || !invoice.value || amountValue.value === null || method.value === null) return

  submitting.value = true
  error.value = null
  try {
    let proofUrl: string | undefined
    try {
      proofUrl = await uploadProof()
    } catch {
      error.value = 'อัปโหลดรูปหลักฐานไม่สำเร็จ ลองใหม่อีกครั้ง หรือลบรูปแล้วบันทึกโดยไม่แนบ'
      return
    }

    await createPayment({
      invoiceNumber: invoice.value.invoiceNumber,
      amount: amountValue.value,
      method: method.value,
      paidAt: createPaidAt(),
      reference: optionalText(reference.value),
      proofUrl,
      notes: optionalText(notes.value),
    })
    returnAfterSave()
  } catch (reason) {
    error.value = reason instanceof Error && reason.message
      ? reason.message
      : 'บันทึกการชำระเงินไม่สำเร็จ'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <FormOverlay
    :open="true"
    eyebrow="RECORD PAYMENT"
    :title="title"
    :helper-text="helperText"
    submit-label="บันทึกการชำระเงิน"
    :is-submitting="submitting"
    :is-submit-disabled="!canSubmit"
    :close-on-backdrop="false"
    @close="close"
    @submit="submit"
  >
    <p v-if="loading" class="px-4 py-6 text-sm text-on-surface-variant">กำลังโหลด...</p>

    <div v-else-if="invoice" class="space-y-4 pb-6">
      <FormInput
        id="payment-amount"
        v-model="amount"
        label="จำนวนเงิน (บาท) *"
        type="number"
        inputmode="decimal"
        step="0.01"
        placeholder="0.00"
      />

      <FormOptionGrid v-model="method" label="วิธีชำระ *" :options="methodOptions" variant="compact" />

      <FormInput id="payment-date" v-model="paidDate" label="วันที่ชำระ *" type="date" :max="todaySheetDate()" />

      <FormInput id="payment-reference" v-model="reference" label="เลขอ้างอิง" placeholder="เช่น เลขที่รายการโอน" />

      <section>
        <FormLabel input-id="payment-proof">หลักฐานการชำระ</FormLabel>

        <div v-if="proofPreviewUrl" class="space-y-2">
          <div class="overflow-hidden rounded-xl border border-outline-variant/40 bg-surface-variant">
            <img :src="proofPreviewUrl" alt="หลักฐานการชำระที่แนบ" class="max-h-56 w-full object-contain" />
          </div>
          <div class="flex gap-2">
            <button type="button" class="flex-1 rounded-xl bg-surface-variant py-2.5 text-sm font-medium text-on-surface-variant" :disabled="submitting" @click="pickProof">
              เปลี่ยนรูป
            </button>
            <button type="button" class="flex-1 rounded-xl bg-surface-variant py-2.5 text-sm font-medium text-on-surface-variant" :disabled="submitting" @click="clearProof">
              ลบรูป
            </button>
          </div>
        </div>

        <button
          v-else
          type="button"
          class="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-outline-variant py-6 text-sm font-medium text-on-surface-variant"
          @click="pickProof"
        >
          <span class="material-symbols-outlined text-[20px]" aria-hidden="true">add_photo_alternate</span>
          แนบสลิป / รูปหลักฐาน (ไม่บังคับ)
        </button>

        <input
          id="payment-proof"
          ref="proofInput"
          type="file"
          accept="image/*"
          class="hidden"
          @change="handleProofPick"
        />
      </section>

      <FormTextarea id="payment-notes" v-model="notes" label="หมายเหตุ" placeholder="ไม่บังคับ" />
    </div>

    <div v-if="error" class="mb-6 flex items-center gap-2 rounded-xl bg-error-container px-4 py-3 font-body text-sm text-on-error-container" role="alert">
      <span class="material-symbols-outlined shrink-0 text-[18px]" aria-hidden="true">error</span>{{ error }}
    </div>
  </FormOverlay>
</template>
