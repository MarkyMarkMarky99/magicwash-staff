<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import type { z } from 'zod'
import type { ItemDto } from '@/data/items/items.service'
import { orderItemCreateSchema } from '@contracts/order-items/order-item-api.schema'
import FormInput from '@/shared/components/FormInput.vue'
import FormTextarea from '@/shared/components/FormTextarea.vue'
import FormOverlay from '@/shared/layouts/FormOverlay.vue'

const itemPayloadSchema = orderItemCreateSchema.omit({ orderId: true, createdBy: true })
type ItemPayload = z.infer<typeof itemPayloadSchema>

const props = defineProps<{ open: boolean; orderId: string; selectedItem: ItemDto | null; isSubmitting: boolean; error: string | null }>()
const emit = defineEmits<{ close: []; changeItem: []; submit: [payload: ItemPayload]; clearError: [] }>()
const validationError = ref<string | null>(null)
const form = reactive({ quantity: '1', specialInstructions: '' })
const canSubmit = computed(() => {
  const quantity = Number(form.quantity)
  return props.selectedItem !== null && Number.isInteger(quantity) && quantity > 0
})
const isOpen = computed(() => props.open && props.selectedItem !== null)
const quantityError = computed(() => {
  if (form.quantity.trim() === '' || canSubmit.value) return null
  return 'Quantity must be a whole number greater than 0'
})

function resetForm() {
  form.quantity = '1'
  form.specialInstructions = ''
  validationError.value = null
  emit('clearError')
}

watch([() => props.open, () => props.orderId, () => props.selectedItem?.id], () => {
  resetForm()
}, { immediate: true })

function submit() {
  const item = props.selectedItem
  if (!item || !canSubmit.value || props.isSubmitting) return
  const parsed = itemPayloadSchema.safeParse({
    itemId: item.id,
    description: item.displayNameTh,
    quantity: Number(form.quantity),
    price: null,
    specialInstructions: form.specialInstructions.trim() || null,
  })
  if (!parsed.success) {
    validationError.value = 'Item details are incomplete. Please choose the item again.'
    return
  }
  validationError.value = null
  emit('submit', parsed.data)
}
</script>

<template>
  <FormOverlay :open="isOpen" title="Add item" eyebrow="Order item" submit-label="Add item to order" :is-submitting="props.isSubmitting" :is-submit-disabled="!canSubmit" @close="emit('close')" @submit="submit">
    <fieldset v-if="props.selectedItem" :disabled="props.isSubmitting" class="min-w-0 space-y-5 pb-5">
      <div class="rounded-xl border border-outline-variant/30 bg-surface-container-low p-4">
        <div class="min-w-0"><p class="font-label text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">{{ props.selectedItem.itemCode }}</p><p class="mt-1 font-headline text-base font-bold text-on-surface">{{ props.selectedItem.displayNameTh }}</p></div>
        <button type="button" class="mt-3 text-sm font-bold text-primary underline underline-offset-2" @click="emit('changeItem')">Change item</button>
      </div>
      <p v-if="quantityError" id="order-item-quantity-error" class="rounded-xl border border-error/20 bg-error-container/30 px-3 py-2 text-sm text-on-error-container">{{ quantityError }}</p><p v-if="props.error || validationError" class="rounded-xl border border-error/20 bg-error-container/30 px-3 py-2 text-sm text-on-error-container">{{ props.error || validationError }}</p>
      <FormInput id="order-item-quantity" v-model="form.quantity" label="Quantity *" type="number" placeholder="1" min="1" step="1" inputmode="numeric" :aria-describedby="quantityError ? 'order-item-quantity-error' : undefined" :aria-invalid="Boolean(quantityError)" /><FormTextarea id="order-item-instructions" v-model="form.specialInstructions" label="Additional notes" placeholder="Add any precautions"/>
    </fieldset>
  </FormOverlay>
</template>
