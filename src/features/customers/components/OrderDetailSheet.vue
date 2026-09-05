<script setup lang="ts">
import { ref, toRef, watch } from 'vue'
import { useRouter } from 'vue-router'
import type { OrderListDto } from '../services/order.service'
import { formatSheetDate } from '@/shared/utils/sheet-date'
import { useDuplicateInvoiceWarning } from '@/shared/composables/use-duplicate-invoice-warning'
import BaseOverlay from '@/shared/layouts/BaseOverlay.vue'

const props = defineProps<{
  open: boolean
  order: OrderListDto | null
  canUsePackage: boolean
}>()

const emit = defineEmits<{
  close: []
  bookDelivery: []
  createInvoice: []
  usePackage: []
}>()

const router = useRouter()
const itemsOpen = ref(true)
const {
  warningInvoiceNumber,
  awaitingConfirmation,
  requestCreate,
  confirmCreate,
  cancelCreate,
  reset,
} = useDuplicateInvoiceWarning(toRef(props, 'order'))

watch(
  () => props.order,
  () => {
    itemsOpen.value = true
  },
)

watch(
  () => props.open,
  (open) => {
    if (!open) reset()
  },
)

function handleClose() {
  reset()
  emit('close')
}

function handleCreateInvoice() {
  if (requestCreate()) emit('createInvoice')
}

function confirmInvoiceCreation() {
  if (confirmCreate()) emit('createInvoice')
}

function viewPhotos() {
  if (!props.order) return
  router.replace(`/gallery/BEF-${props.order.orderId}`)
}
</script>

<template>
  <BaseOverlay :open="open" variant="sheet" aria-label="Order details" @close="handleClose">
    <div class="flex min-h-full flex-col">
      <div
        class="flex flex-none items-center justify-between gap-3 border-b border-outline-variant/20 px-4 pb-2 pr-14 pt-0.5"
      >
        <div class="min-w-0 flex-1">
          <p class="mb-0.5 font-label text-[9px] font-bold uppercase tracking-widest text-on-surface-variant">Order</p>
          <h2 class="truncate font-headline text-base font-bold text-primary">{{ order?.orderId || '-' }}</h2>
        </div>
      </div>

      <!-- Dates + primary action: pinned below the header, above the scroll area,
           so "view photos" never requires scrolling to reach. -->
      <div v-if="order" class="flex-none space-y-3 px-4 pb-2 pt-3">
          <div class="flex items-stretch gap-2">
            <div class="flex-1 rounded-xl bg-surface-container-low px-3 py-2.5">
              <p class="mb-1 font-label text-[9px] uppercase tracking-wide text-on-surface-variant">Received</p>
              <p class="font-headline text-[13px] font-bold leading-tight text-on-surface">{{ formatSheetDate(order.receivedDate) }}</p>
            </div>
            <div class="flex items-center px-1">
              <span class="material-symbols-outlined text-[16px] leading-none text-outline" aria-hidden="true">arrow_forward</span>
            </div>
            <div class="flex-1 rounded-xl bg-surface-container-low px-3 py-2.5">
              <p class="mb-1 font-label text-[9px] uppercase tracking-wide text-on-surface-variant">Due</p>
              <p class="font-headline text-[13px] font-bold leading-tight text-on-surface">{{ formatSheetDate(order.dueDate) }}</p>
            </div>
          </div>

          <button
            type="button"
            class="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 font-label text-[12px] font-semibold text-on-primary transition-all hover:bg-primary/90 active:scale-[0.98]"
            @click="viewPhotos"
          >
            <span class="material-symbols-outlined text-[16px] leading-none" aria-hidden="true">photo_library</span>
            View Photos
          </button>

          <button
            type="button"
            class="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 font-label text-[12px] font-semibold text-on-primary transition-all hover:bg-primary/90 active:scale-[0.98]"
            @click="emit('bookDelivery')"
          >
            <span class="material-symbols-outlined text-[16px] leading-none" aria-hidden="true">local_shipping</span>
            Book Delivery
          </button>

          <div v-if="warningInvoiceNumber" class="flex items-start gap-2 rounded-xl border border-tertiary/30 bg-tertiary-container/20 px-3 py-2.5 text-on-surface">
            <span class="material-symbols-outlined mt-0.5 shrink-0 text-[18px] leading-none text-tertiary" aria-hidden="true">warning</span>
            <p class="font-body text-xs leading-relaxed">
              This order already has invoice <span class="font-semibold">{{ warningInvoiceNumber }}</span>.
              You can still create another invoice.
            </p>
          </div>

          <button
            v-if="!awaitingConfirmation"
            type="button"
            class="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 font-label text-[12px] font-semibold text-on-primary transition-all hover:bg-primary/90 active:scale-[0.98]"
            @click="handleCreateInvoice"
          >
            <span class="material-symbols-outlined text-[16px] leading-none" aria-hidden="true">receipt_long</span>
            Create Invoice
          </button>

          <div v-else class="space-y-2 rounded-xl border border-tertiary/30 bg-tertiary-container/20 p-3">
            <p class="font-body text-xs leading-relaxed text-on-surface">
              Create another invoice for this order anyway?
            </p>
            <div class="flex gap-2">
              <button
                type="button"
                class="flex-1 rounded-xl bg-primary py-2.5 font-label text-[12px] font-semibold text-on-primary transition-all hover:bg-primary/90 active:scale-[0.98]"
                @click="confirmInvoiceCreation"
              >
                Go ahead
              </button>
              <button
                type="button"
                class="flex-1 rounded-xl bg-surface-container py-2.5 font-label text-[12px] font-semibold text-primary transition-all hover:bg-surface-container-high active:scale-[0.98]"
                @click="cancelCreate"
              >
                Cancel
              </button>
            </div>
          </div>
          <button
            v-if="canUsePackage"
            type="button"
            class="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 font-label text-[12px] font-semibold text-on-primary transition-all hover:bg-primary/90 active:scale-[0.98]"
            @click="emit('usePackage')"
          >
            <span class="material-symbols-outlined text-[16px] leading-none" aria-hidden="true">card_membership</span>
            Use package credit
          </button>
      </div>

      <div class="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <div v-if="order" class="space-y-4">
            <section v-if="order.items.length > 0" class="w-full overflow-hidden rounded-2xl">
              <div
                class="flex cursor-pointer select-none items-center justify-between bg-surface-container-low px-4 py-2 text-primary"
                @click="itemsOpen = !itemsOpen"
              >
                <div class="flex items-center gap-2.5">
                  <span class="material-symbols-outlined text-[16px] text-primary" aria-hidden="true">checkroom</span>
                  <h2 class="font-headline text-[13px] font-bold tracking-tight">Items</h2>
                </div>
                <div class="flex items-center gap-2">
                  <div class="flex h-[22px] items-center gap-1.5 rounded-full bg-surface-container px-2.5">
                    <span class="font-label text-[9px] font-bold uppercase tracking-wider text-on-surface-variant">
                      {{ order.quantity ?? order.items.length }} pcs
                    </span>
                  </div>
                  <span
                    class="material-symbols-outlined text-[16px] text-primary transition-transform"
                    :class="itemsOpen ? 'rotate-180' : ''"
                    aria-hidden="true"
                  >expand_more</span>
                </div>
              </div>
              <ul v-if="itemsOpen" class="divide-y divide-outline-variant/10">
                <li
                  v-for="(item, index) in order.items"
                  :key="item.id || `${order.orderId}-${index}`"
                  class="flex items-center gap-3 px-4 py-3"
                >
                  <div class="min-w-0 flex-1">
                    <p class="truncate font-body text-sm font-medium leading-tight text-on-surface">
                      {{ item.description || '—' }}
                    </p>
                    <p v-if="item.serviceType" class="mt-0.5 font-body text-[11px] text-on-surface-variant">{{ item.serviceType }}</p>
                  </div>
                  <span class="shrink-0 font-label text-[11px] font-semibold text-on-surface-variant">
                    {{ item.quantity ?? '-' }} pcs
                  </span>
                </li>
              </ul>
            </section>

            <div v-if="order.note" class="flex items-start gap-2 rounded-xl bg-surface-container-low px-3 py-2.5">
              <span class="material-symbols-outlined mt-0.5 shrink-0 text-[16px] leading-none text-on-surface-variant" aria-hidden="true">edit_note</span>
              <p class="font-body text-sm leading-relaxed text-on-surface-variant">{{ order.note }}</p>
            </div>
          </div>
      </div>
    </div>
  </BaseOverlay>
</template>
