<script setup lang="ts">
import { computed } from 'vue'
import type { BillingDraft, BillingDraftLine } from '@contracts/ai-gateway/billing-draft.schema'
import PhotoViewer from '@/shared/components/PhotoViewer.vue'
import { useBillingPhotoRoute } from '../composables/useBillingPhotoRoute'
import AgentCardFrame from './AgentCardFrame.vue'

const props = defineProps<{ draft: BillingDraft, viewerKey: string }>()
defineEmits<{ open: [draft: BillingDraft] }>()

type BillingCitation = BillingDraftLine['citations'][number]

interface CitationGroup {
  citation: BillingCitation
  photoIds: string[]
}

const viewer = useBillingPhotoRoute()

const photos = computed(() => {
  const ids = new Map<string, string>()
  for (const line of props.draft.lines) {
    for (const citation of line.citations) {
      if (citation.photoUrl && !ids.has(citation.photoUrl)) ids.set(citation.photoUrl, `${props.viewerKey}~${ids.size}`)
    }
  }
  return ids
})

const viewerImages = computed(() => [...photos.value].map(([src, id]) => ({ id, src, alt: 'Garment photo' })))

const activePhoto = computed(() => {
  const id = viewer.openPhotoId.value
  return id !== null && viewerImages.value.some(image => image.id === id) ? id : null
})

function citationGroups(line: BillingDraftLine): CitationGroup[] {
  const groups = new Map<string, CitationGroup>()
  for (const citation of line.citations) {
    const group = groups.get(citation.invoiceItemId) ?? { citation, photoIds: [] }
    const id = citation.photoUrl ? photos.value.get(citation.photoUrl) : undefined
    if (id && !group.photoIds.includes(id)) group.photoIds.push(id)
    groups.set(citation.invoiceItemId, group)
  }
  return [...groups.values()]
}

function photoSrc(id: string): string {
  return viewerImages.value.find(image => image.id === id)?.src ?? ''
}

const SOURCE_LABELS: Record<BillingDraftLine['source'], string> = {
  'customer-history': 'This customer',
  'other-history': 'Other customer',
  'price-list': 'Price list',
  chat: 'Set in chat',
  'needs-price': 'Needs price',
}
const SOURCE_CLASSES: Record<BillingDraftLine['source'], string> = {
  'customer-history': 'bg-success-container text-on-success-container',
  'other-history': 'bg-secondary-container text-primary',
  'price-list': 'bg-surface-container text-on-surface-variant',
  chat: 'bg-surface-container text-on-surface-variant',
  'needs-price': 'bg-warning-container text-on-warning-container',
}
const PHOTO_LABELS = { exact: 'Exact photo', probable: 'Probable photo', none: 'No photo' } as const
const PHOTO_CLASSES = {
  exact: 'bg-success-container text-on-success-container',
  probable: 'bg-warning-container text-on-warning-container',
  none: 'bg-surface-container text-on-surface-variant',
} as const

function formatPrice(price: number): string {
  return `฿${price.toLocaleString('en-US')}`
}

function needsPrice(line: BillingDraftLine): boolean {
  return line.unitPrice === null
}

function listPrice(line: BillingDraftLine): number | null {
  const price = line.priceListRow?.price ?? null
  return price !== null && price !== line.unitPrice ? price : null
}
</script>

<template>
  <AgentCardFrame title="Bill draft">
    <p class="mb-2 font-body text-[13px] font-extrabold text-primary">{{ draft.orderId }}</p>
    <ul class="font-body text-[13px]">
      <li v-for="(line, index) in draft.lines" :key="index" class="border-b border-dashed border-outline-variant py-2 first:pt-0 last:border-b-0">
        <div class="flex items-start justify-between gap-2">
          <p class="min-w-0 font-semibold leading-snug [overflow-wrap:anywhere]">
            {{ line.description }}
            <span class="block text-[11px] font-medium text-on-surface-variant">{{ line.quantity }} × {{ line.unit }}</span>
          </p>
          <span class="whitespace-nowrap text-sm font-extrabold" :class="needsPrice(line) ? 'text-warning' : 'text-primary'">{{ needsPrice(line) || line.unitPrice === null ? 'Needs price' : formatPrice(line.unitPrice) }}</span>
        </div>
        <div class="mt-1 flex flex-wrap items-center gap-1.5">
          <span class="rounded-full px-2 py-0.5 font-label text-[10px] font-extrabold uppercase" :class="SOURCE_CLASSES[line.source]">{{ SOURCE_LABELS[line.source] }}</span>
          <span v-if="line.photoMatch" class="rounded-full px-2 py-0.5 font-label text-[10px] font-extrabold uppercase" :class="PHOTO_CLASSES[line.photoMatch]">{{ PHOTO_LABELS[line.photoMatch] }}</span>
          <span v-if="listPrice(line) !== null" class="text-[11px] font-medium text-on-surface-variant">List: {{ formatPrice(listPrice(line)!) }}</span>
        </div>
        <p v-if="line.reason" class="mt-0.5 text-[11px] font-medium text-on-surface-variant [overflow-wrap:anywhere]">{{ line.reason }}</p>
        <ul v-if="line.citations.length" class="mt-1 flex flex-col gap-1.5">
          <li v-for="group in citationGroups(line)" :key="group.citation.invoiceItemId" class="flex flex-wrap items-center gap-x-2.5 text-[11px] font-bold text-primary">
            <RouterLink :to="{ name: 'invoice-detail', params: { invoiceNumber: group.citation.invoiceNumber } }" class="underline">{{ group.citation.invoiceNumber }}</RouterLink>
            <RouterLink v-if="group.citation.orderId" :to="{ name: 'order-detail', params: { orderId: group.citation.orderId } }" class="underline">{{ group.citation.orderId }}</RouterLink>
            <span class="basis-full font-medium text-on-surface-variant [overflow-wrap:anywhere]">{{ group.citation.description }} · {{ group.citation.quantity ?? '?' }} × {{ group.citation.unit ?? '' }} · {{ formatPrice(group.citation.unitPrice) }}</span>
            <span v-if="group.photoIds.length" class="mt-1 flex basis-full gap-1.5 overflow-x-auto [scrollbar-width:none]">
              <button v-for="id in group.photoIds" :key="id" type="button" class="h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 border-primary bg-surface-container" aria-label="View garment photo" @click="viewer.open(id)">
                <img :src="photoSrc(id)" alt="" class="h-full w-full object-cover" loading="lazy" decoding="async">
              </button>
            </span>
          </li>
        </ul>
      </li>
    </ul>
    <p v-for="warning in draft.warnings" :key="`${warning.lineIndex}-${warning.message}`" class="mt-2.5 flex items-start gap-1.5 font-body text-xs font-bold leading-snug text-warning">
      <span class="material-symbols-outlined mt-px text-[16px]" aria-hidden="true">warning</span>
      <span>{{ warning.message }}</span>
    </p>
    <div class="mt-3 grid gap-2">
      <button type="button" class="flex h-[46px] items-center justify-center gap-1.5 rounded-full bg-primary px-4 font-body text-sm font-extrabold text-on-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime" @click="$emit('open', draft)">
        <span class="material-symbols-outlined text-[20px]" aria-hidden="true">receipt_long</span>Open in invoice form
      </button>
    </div>
    <PhotoViewer v-if="activePhoto" :images="viewerImages" :active-id="activePhoto" @change="viewer.open($event, true)" @close="viewer.close" />
  </AgentCardFrame>
</template>
