<script setup lang="ts">
import { computed } from 'vue'
import CustomerTabCard from '@/shared/components/CustomerTabCard.vue'
import FormPageHeader from '@/shared/components/FormPageHeader.vue'
import { dueStubLabel, receivedLabel } from '@/features/orders/utils/corporate-order-draft'
import { dueBeforeReceived } from '@/features/orders/utils/order-intake-draft'

const props = defineProps<{
  customerName: string | null
  customerSub: string | null
  loading: boolean
  problem: string | null
  orderName: string
  note: string
  serviceLabel: string
  receivedDate: string
  dueDate: string
}>()
const emit = defineEmits<{ close: [], edit: [] }>()

const due = computed(() => dueStubLabel(props.dueDate))
const bad = computed(() => dueBeforeReceived(props.receivedDate, props.dueDate))
</script>

<template>
  <FormPageHeader eyebrow="New laundry intake" title="New order" @close="emit('close')">
    <CustomerTabCard
      class="cust-edit"
      :customer-name="customerName"
      :customer-sub="customerSub"
      :loading="loading"
      :problem="problem"
      :invalid="bad"
      role="button"
      tabindex="0"
      aria-label="Edit order details"
      @click="emit('edit')"
      @keydown.enter.prevent="emit('edit')"
      @keydown.space.prevent="emit('edit')"
    >
      <template #name-aside>
        <span class="material-symbols-outlined flex-none text-[16px] text-on-surface-variant" aria-hidden="true">edit</span>
      </template>
      <div class="my-2 border-t-[1.5px] border-dashed border-outline-variant" />
      <p v-if="orderName" class="truncate text-[13px] font-bold">{{ orderName }}</p>
      <p v-if="note" class="mt-[3px] flex min-w-0 items-center gap-1 text-[11.5px] text-on-surface-variant">
        <span class="material-symbols-outlined flex-none text-[14px]" aria-hidden="true">sticky_note_2</span>
        <span class="truncate">{{ note }}</span>
      </p>
      <p class="rec">
        Received <b>{{ receivedLabel(receivedDate) }}</b> · <span class="svc">{{ serviceLabel }}</span>
      </p>
      <template #aside>
        <div class="tile">
          <span class="tile__key">Due</span>
          <span class="tile__day">{{ due.day }}</span>
          <span class="tile__month">{{ due.month }}</span>
        </div>
      </template>
    </CustomerTabCard>
  </FormPageHeader>
</template>

<style scoped>
.cust-edit {
  cursor: pointer;
}

.rec {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  align-self: flex-start;
  margin-top: auto;
  padding-top: 8px;
  color: var(--color-on-surface-variant);
  font-size: 11.5px;
  font-weight: 500;
  line-height: 1.2;
}

.rec b {
  border-bottom: 1px dashed var(--color-on-surface-variant);
  color: var(--color-primary);
  font-weight: 800;
}

.svc {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px 3px;
  border-radius: 999px;
  background: var(--color-secondary-container);
  color: var(--color-on-secondary-container);
  font-size: 10px;
  font-weight: 800;
  white-space: nowrap;
}

.tile {
  position: relative;
  display: flex;
  flex: none;
  flex-direction: column;
  align-self: flex-start;
  width: 82px;
  overflow: hidden;
  border: 2px solid var(--color-primary);
  border-radius: 11px 13px 11px 12px;
  background: white;
  color: var(--color-primary);
  box-shadow: 3px 3px 0 color-mix(in srgb, var(--color-primary) 70%, black);
  transform: rotate(2deg);
}

.tile__key {
  padding: 3px 0 4px;
  background: var(--color-primary);
  color: white;
  font-size: 9.5px;
  font-weight: 800;
  letter-spacing: .16em;
  line-height: 1;
  text-align: center;
  text-transform: uppercase;
}

.tile__day {
  padding-top: 4px;
  font-size: 40px;
  font-weight: 800;
  line-height: 1;
  text-align: center;
  font-variant-numeric: tabular-nums;
}

.tile__month {
  padding: 3px 0 7px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: .06em;
  line-height: 1;
  text-align: center;
  text-transform: uppercase;
}

.cust--bad .tile {
  background: var(--color-warning-container);
  color: var(--color-on-warning-container);
}

.cust--bad .tile__key {
  background: var(--color-warning);
  color: white;
}
</style>
