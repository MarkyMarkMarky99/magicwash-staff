<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import BaseBadge from '@/shared/components/BaseBadge.vue'
import FormInput from '@/shared/components/FormInput.vue'
import FormOptionGrid from '@/shared/components/FormOptionGrid.vue'
import FormTextarea from '@/shared/components/FormTextarea.vue'
import DetailOverlay from '@/shared/layouts/DetailOverlay.vue'
import {
  dueBeforeReceived,
  orderIntakeServiceOptions,
  type OrderIntakeDetails,
  type OrderIntakeServiceType,
} from '@/features/orders/utils/order-intake-draft'

const props = defineProps<{
  open: boolean
  customerName: string | null
  customerSub: string | null
  details: OrderIntakeDetails
}>()
const emit = defineEmits<{
  close: []
  apply: [details: OrderIntakeDetails]
}>()

const form = reactive<OrderIntakeDetails>({ ...props.details })
const dueBefore = computed(() => dueBeforeReceived(form.receivedDate, form.dueDate))

watch(() => props.open, (open) => {
  if (open) Object.assign(form, props.details)
})

function setService(value: string | null): void {
  if (value) form.serviceType = value as OrderIntakeServiceType
}

function apply(): void {
  emit('apply', {
    orderName: form.orderName.trim(),
    note: form.note.trim(),
    serviceType: form.serviceType,
    receivedDate: form.receivedDate || props.details.receivedDate,
    dueDate: form.dueDate || props.details.dueDate,
  })
}
</script>

<template>
  <DetailOverlay :open="open" ariaLabel="Order details" size="auto" @close="emit('close')">
    <template #header>
      <h2 class="px-5 pb-2 pr-16 pt-1 font-headline text-lg font-extrabold">Order details</h2>
    </template>
    <div class="flex flex-col gap-4 px-5 pb-5 pt-1">
      <section>
        <p class="mb-1.5 text-xs font-bold text-on-surface">Customer</p>
        <div class="flex h-14 items-center gap-2.5 rounded-xl border border-outline-variant bg-surface-container-low px-3">
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-extrabold text-primary">{{ customerName ?? '—' }}</p>
            <p v-if="customerSub" class="truncate text-[11px] text-on-surface-variant">{{ customerSub }}</p>
          </div>
          <span class="material-symbols-outlined text-[20px] text-on-surface-variant" aria-hidden="true">lock</span>
        </div>
      </section>
      <FormInput id="intake-order-name" v-model="form.orderName" label="Order name" />
      <FormTextarea id="intake-order-note" v-model="form.note" label="Note" />
      <FormOptionGrid :model-value="form.serviceType" label="Service type" :options="orderIntakeServiceOptions" @update:model-value="setService" />
      <div class="flex flex-col gap-1.5">
        <div class="grid grid-cols-2 gap-4">
          <FormInput id="intake-received-date" v-model="form.receivedDate" label="Received date" type="date" />
          <FormInput id="intake-due-date" v-model="form.dueDate" label="Due date" type="date" />
        </div>
        <div v-if="dueBefore" class="flex">
          <BaseBadge label="Due before received" tone="warning" size="lg" />
        </div>
      </div>
      <div class="flex gap-2.5">
        <button type="button" class="h-[52px] flex-1 rounded-full border-2 border-primary bg-white font-headline text-base font-bold text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime" @click="emit('close')">Cancel</button>
        <button type="button" class="h-[52px] flex-1 rounded-full bg-primary font-headline text-base font-bold text-on-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime" @click="apply">Done</button>
      </div>
    </div>
  </DetailOverlay>
</template>
