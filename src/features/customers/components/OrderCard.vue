<script setup lang="ts">
import { useRouter } from 'vue-router'
import type { OrderListDto } from '../services/order.service'
import { normalizeSheetDate } from '@/shared/utils/sheet-date'
import { formatShortDate } from '../utils/format-date'

const props = defineProps<{
  order: OrderListDto
}>()

const emit = defineEmits<{
  select: [order: OrderListDto]
}>()

const router = useRouter()

interface StatusPresentation {
  icon: string
  label: string
  badgeClass: string
  avatarClass: string
}

// Unknown status values fall through to a neutral presentation rather than guessing.
const STATUS_PRESENTATION: Record<string, StatusPresentation> = {
  SUBMITTED: { icon: 'local_laundry_service', label: 'Submitted', badgeClass: 'bg-amber-100 text-amber-700', avatarClass: 'bg-amber-50 text-amber-600' },
  PENDING: { icon: 'schedule', label: 'Pending', badgeClass: 'bg-amber-100 text-amber-700', avatarClass: 'bg-amber-50 text-amber-600' },
  APPROVED: { icon: 'task_alt', label: 'Approved', badgeClass: 'bg-blue-100 text-blue-700', avatarClass: 'bg-blue-50 text-blue-700' },
  CONFIRM: { icon: 'check_circle', label: 'Confirmed', badgeClass: 'bg-green-100 text-green-700', avatarClass: 'bg-green-50 text-green-700' },
  RECEIVED: { icon: 'inventory_2', label: 'Received', badgeClass: 'bg-teal-50 text-teal-700', avatarClass: 'bg-teal-50 text-teal-700' },
  COMPLETED: { icon: 'done_all', label: 'Completed', badgeClass: 'bg-green-100 text-green-700', avatarClass: 'bg-green-50 text-green-700' },
}

const FALLBACK_PRESENTATION: StatusPresentation = {
  icon: 'receipt_long',
  label: 'Unknown',
  badgeClass: 'bg-gray-100 text-gray-600',
  avatarClass: 'bg-gray-100 text-gray-500',
}

function presentationFor(status: string | null): StatusPresentation {
  if (!status) return FALLBACK_PRESENTATION
  return STATUS_PRESENTATION[status] ?? { ...FALLBACK_PRESENTATION, label: status }
}

function viewPhotos() {
  router.push(`/gallery/AFT-${props.order.orderId}`)
}

function selectOrder() {
  emit('select', props.order)
}
</script>

<template>
  <article
    class="flex cursor-pointer gap-3 px-4 py-3 transition-colors hover:bg-surface-container-low active:bg-surface-container"
    role="button"
    tabindex="0"
    @click="selectOrder"
    @keydown.enter="selectOrder"
    @keydown.space.prevent="selectOrder"
  >
    <div
      class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-outline-variant/10"
      :class="presentationFor(order.status).avatarClass"
    >
      <span class="material-symbols-outlined text-[20px]" aria-hidden="true">{{ presentationFor(order.status).icon }}</span>
    </div>

    <div class="min-w-0 flex-grow">
      <div class="mb-0.5 flex items-center justify-between gap-2">
        <div class="flex min-w-0 items-center gap-1.5">
          <h3 class="truncate font-headline text-[14px] font-bold leading-tight text-primary">
            {{ formatShortDate(normalizeSheetDate(order.receivedDate)) }}
          </h3>
          <span
            class="shrink-0 rounded-full px-1.5 py-px font-label text-[9px] font-bold uppercase tracking-wide"
            :class="presentationFor(order.status).badgeClass"
          >
            {{ presentationFor(order.status).label }}
          </span>
        </div>
        <span class="shrink-0 font-body text-[11px] font-semibold text-on-surface-variant">
          {{ order.quantity != null ? `${order.quantity} pcs` : '' }}
        </span>
      </div>

      <div class="flex items-center justify-between gap-2">
        <p class="truncate font-body text-xs text-on-surface-variant">
          {{ order.note || order.serviceType || '—' }}
        </p>
        <button
          type="button"
          class="shrink-0 p-1 text-primary transition hover:opacity-70 active:scale-95"
          aria-label="View photos"
          @click.stop="viewPhotos"
        >
          <span class="material-symbols-outlined text-[16px]" aria-hidden="true">photo_library</span>
        </button>
      </div>
    </div>
  </article>
</template>
