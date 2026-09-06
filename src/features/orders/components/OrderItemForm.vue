<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import type { z } from 'zod'
import type { priceListListResponseSchema } from '@contracts/price-list/price-list-api.schema'
import { orderItemCreateSchema } from '@contracts/order-items/order-item-api.schema'
import FormInput from '@/shared/components/FormInput.vue'
import FormTextarea from '@/shared/components/FormTextarea.vue'
import FormOverlay from '@/shared/layouts/FormOverlay.vue'
import { serviceTypeLabel } from '@/shared/utils/service-type-labels'
import { formatOrderPrice } from '@/features/orders/utils/order-price-format'

type PriceListItem = z.infer<typeof priceListListResponseSchema>
const itemPayloadSchema = orderItemCreateSchema.omit({ orderId: true, createdBy: true })
type ItemPayload = z.infer<typeof itemPayloadSchema>

const props = defineProps<{ open: boolean; orderId: string; selectedItem: PriceListItem | null; isSubmitting: boolean; error: string | null }>()
const emit = defineEmits<{ close: []; changeItem: []; submit: [payload: ItemPayload]; clearError: [] }>()
const submitted = ref(false)
const validationError = ref<string | null>(null)
const form = reactive({ quantity: '1', specialInstructions: '' })
const canSubmit = computed(() => props.selectedItem !== null && Number.isFinite(Number(form.quantity)) && Number(form.quantity) > 0)
const isOpen = computed(() => props.open && props.selectedItem !== null)

function resetForm() {
  form.quantity = '1'
  form.specialInstructions = ''
  submitted.value = false
  validationError.value = null
  emit('clearError')
}

watch([() => props.open, () => props.orderId, () => props.selectedItem?.id], () => {
  resetForm()
}, { immediate: true })

function submit() {
  submitted.value = true
  const item = props.selectedItem
  if (!item || !canSubmit.value || props.isSubmitting) return
  const parsed = itemPayloadSchema.safeParse({
    itemId: item.id,
    description: item.displayNameTh,
    quantity: Number(form.quantity),
    price: item.price,
    specialInstructions: form.specialInstructions.trim() || null,
  })
  if (!parsed.success) {
    validationError.value = 'ข้อมูลรายการไม่ครบหรือราคาไม่ถูกต้อง กรุณาเลือกสินค้าใหม่'
    return
  }
  validationError.value = null
  emit('submit', parsed.data)
}
</script>

<template>
  <FormOverlay :open="isOpen" title="เพิ่มรายการสินค้า" eyebrow="Order item" submit-label="เพิ่มรายการลงออเดอร์" :is-submitting="props.isSubmitting" :is-submit-disabled="!canSubmit" @close="emit('close')" @submit="submit">
    <fieldset v-if="props.selectedItem" :disabled="props.isSubmitting" class="min-w-0 space-y-5 pb-5">
      <div class="rounded-xl border border-outline-variant/30 bg-surface-container-low p-4">
        <div class="flex items-start justify-between gap-3"><div class="min-w-0"><p class="font-label text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">{{ props.selectedItem.itemCode }}</p><p class="mt-1 font-headline text-base font-bold text-on-surface">{{ props.selectedItem.displayNameTh }}</p><p class="mt-1 text-xs text-on-surface-variant">{{ [props.selectedItem.variant, serviceTypeLabel(props.selectedItem.serviceType), props.selectedItem.unit && `ต่อ ${props.selectedItem.unit}`].filter(Boolean).join(' · ') }}</p></div><p class="shrink-0 font-headline text-lg font-extrabold text-primary">{{ formatOrderPrice(props.selectedItem.price) }}</p></div>
        <button type="button" class="mt-3 text-sm font-bold text-primary underline underline-offset-2" @click="emit('changeItem')">เปลี่ยนสินค้า</button>
      </div>
      <p v-if="submitted && !canSubmit" class="rounded-xl border border-error/20 bg-error-container/30 px-3 py-2 text-sm text-on-error-container">กรุณาระบุจำนวนที่มากกว่า 0</p><p v-if="props.error || validationError" class="rounded-xl border border-error/20 bg-error-container/30 px-3 py-2 text-sm text-on-error-container">{{ props.error || validationError }}</p>
      <FormInput id="order-item-quantity" v-model="form.quantity" label="จำนวน *" type="number" placeholder="1" /><FormTextarea id="order-item-instructions" v-model="form.specialInstructions" label="คำแนะนำเพิ่มเติม" placeholder="ระบุข้อควรระวังได้"/>
    </fieldset>
  </FormOverlay>
</template>
