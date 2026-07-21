<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import type { OrderListDto } from '../services/order.service'

const props = defineProps<{
  open: boolean
  order: OrderListDto | null
}>()

const emit = defineEmits<{
  close: []
}>()

const router = useRouter()
const itemsOpen = ref(true)

watch(
  () => props.order,
  () => {
    itemsOpen.value = true
  },
)

function viewPhotos() {
  if (!props.order) return
  emit('close')
  router.push(`/gallery/AFT-${props.order.orderId}`)
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 z-[100] flex items-end">
      <button
        type="button"
        class="absolute inset-0 bg-black/40"
        aria-label="Close order details"
        @click="emit('close')"
      />

      <section class="relative max-h-[84vh] w-full overflow-hidden rounded-t-2xl bg-white shadow-2xl">
        <header class="flex items-center justify-between gap-3 border-b border-outline-variant/20 px-4 py-3">
          <div class="min-w-0">
            <h2 class="font-headline text-base font-bold text-primary">Order details</h2>
            <p class="truncate text-xs text-on-surface-variant">{{ order?.orderId || '-' }}</p>
          </div>
          <button
            type="button"
            class="flex h-8 w-8 items-center justify-center rounded-full text-primary hover:bg-surface-container"
            aria-label="Close"
            @click="emit('close')"
          >
            <span class="material-symbols-outlined text-[20px]" aria-hidden="true">close</span>
          </button>
        </header>

        <div class="max-h-[calc(84vh-64px)] overflow-y-auto px-4 py-4">
          <dl class="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt class="text-xs text-on-surface-variant">Received</dt>
              <dd class="font-medium text-on-surface">{{ order?.receivedDate || '-' }}</dd>
            </div>
            <div>
              <dt class="text-xs text-on-surface-variant">Due</dt>
              <dd class="font-medium text-on-surface">{{ order?.dueDate || '-' }}</dd>
            </div>
          </dl>

          <div v-if="order" class="mt-5">
            <button
              type="button"
              class="flex w-full items-center justify-between border-b border-outline-variant/20 pb-2 text-left"
              @click="itemsOpen = !itemsOpen"
            >
              <span class="font-headline text-sm font-bold text-primary">Items ({{ order.items.length }})</span>
              <span class="material-symbols-outlined text-[19px] text-primary" aria-hidden="true">
                {{ itemsOpen ? 'expand_less' : 'expand_more' }}
              </span>
            </button>

            <div v-if="itemsOpen" class="mt-2 flex flex-col gap-2">
              <p v-if="order.items.length === 0" class="text-sm text-on-surface-variant">No item details</p>
              <div
                v-for="(item, index) in order.items"
                :key="item.id || `${order.orderId}-${index}`"
                class="rounded-lg bg-surface-container-low px-3 py-2 text-sm"
              >
                <div class="flex items-center justify-between gap-3">
                  <span class="font-medium text-on-surface">{{ item.description || item.serviceType || 'Item' }}</span>
                  <span class="shrink-0 text-xs text-on-surface-variant">{{ item.quantity ?? '-' }}</span>
                </div>
              </div>
            </div>
          </div>

          <p class="mt-5 text-sm text-on-surface-variant">
            <span class="font-bold text-on-surface">Note:</span>
            {{ order?.note || '-' }}
          </p>

          <button
            type="button"
            class="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-bold text-on-primary transition hover:opacity-90"
            :disabled="!order"
            @click="viewPhotos"
          >
            <span class="material-symbols-outlined text-[19px]" aria-hidden="true">photo_library</span>
            View Photos
          </button>
        </div>
      </section>
    </div>
  </Teleport>
</template>
