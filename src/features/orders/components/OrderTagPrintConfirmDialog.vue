<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import ConfirmOverlay from '@/shared/layouts/ConfirmOverlay.vue'
import FormInput from '@/shared/components/FormInput.vue'

const MIN_TAG_COUNT = 1
const MAX_TAG_COUNT = 999

const props = defineProps<{
  open: boolean
  totalCount: number
  printing: boolean
}>()

const emit = defineEmits<{
  close: []
  confirm: [totalCount: number]
}>()

const editableCount = ref('')

const validationMessage = computed(() => {
  const value = editableCount.value.trim()
  if (!/^\d+$/.test(value)) return `ระบุจำนวนแท็กเป็นจำนวนเต็ม ${MIN_TAG_COUNT}–${MAX_TAG_COUNT} ใบ`

  const totalCount = Number(value)
  if (totalCount < MIN_TAG_COUNT || totalCount > MAX_TAG_COUNT) {
    return `จำนวนแท็กต้องอยู่ระหว่าง ${MIN_TAG_COUNT}–${MAX_TAG_COUNT} ใบ`
  }

  return ''
})

const canConfirm = computed(() => !props.printing && !validationMessage.value)

function resetEditableCount() {
  editableCount.value = String(props.totalCount)
}

function handleClose() {
  if (!props.printing) emit('close')
}

function handleConfirm() {
  if (!canConfirm.value) return
  emit('confirm', Number(editableCount.value))
}

watch(
  () => [props.open, props.totalCount] as const,
  ([open]) => {
    if (open) resetEditableCount()
  },
  { immediate: true },
)
</script>

<template>
  <ConfirmOverlay
    :open="open"
    title="ยืนยันการพิมพ์แท็ก"
    description="ตรวจสอบจำนวนแท็กก่อนส่งไปยังเครื่องพิมพ์ TSC"
    aria-label="ยืนยันการพิมพ์แท็ก"
    cancel-label="ยกเลิก"
    :confirm-label="printing ? 'กำลังส่งพิมพ์…' : 'พิมพ์แท็ก'"
    :confirm-disabled="!canConfirm"
    @close="handleClose"
    @confirm="handleConfirm"
  >
    <div class="space-y-3 pb-1">
      <FormInput
        id="order-tag-print-count"
        v-model="editableCount"
        label="จำนวนแท็ก"
        type="number"
        min="1"
        max="999"
        step="1"
        inputmode="numeric"
        autocomplete="off"
        autofocus
        :aria-describedby="validationMessage ? 'order-tag-print-count-error' : 'order-tag-print-count-help'"
        :aria-invalid="Boolean(validationMessage)"
      />
      <p id="order-tag-print-count-help" class="font-body text-xs leading-relaxed text-on-surface-variant">
        พิมพ์ได้ครั้งละ 1–999 ใบ
      </p>
      <p
        v-if="validationMessage"
        id="order-tag-print-count-error"
        class="rounded-xl bg-error-container px-3 py-2 font-body text-xs text-on-error-container"
        role="alert"
      >
        {{ validationMessage }}
      </p>
    </div>
  </ConfirmOverlay>
</template>
