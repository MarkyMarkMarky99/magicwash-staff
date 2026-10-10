<script setup lang="ts">
import { ref } from 'vue'
import type { MachineDto } from '@/data/machines/machines.service'
import type { WashProductDto } from '@/data/wash-products/wash-products.service'
import type { WashProgramDto } from '@/data/wash-programs/wash-programs.service'
import { defaultWashOptions, type WashOptions } from '@/features/wash-queue/wash-options'
import WashQueueBookDialog from '@/features/wash-queue/components/WashQueueBookDialog.vue'

defineOptions({ name: 'WashQueueBookPreviewPage' })

// Dev-only: shows the booking dialog with sample data. Nothing is uploaded or saved.
const machines: MachineDto[] = [
  { id: 'WSH10-01', type: 'WSH', name: 'Washer 10', capacityKg: 10, status: 'ACTIVE', sortOrder: 1, note: null },
  { id: 'WSH15-01', type: 'WSH', name: 'Washer 15', capacityKg: 15, status: 'ACTIVE', sortOrder: 2, note: null },
  { id: 'WSH20-01', type: 'WSH', name: 'Washer 20', capacityKg: 20, status: 'ACTIVE', sortOrder: 3, note: null },
]
const palette = getComputedStyle(document.documentElement)
const photoUrl = 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 343 150" preserveAspectRatio="xMidYMid slice" aria-label="Basket of towels on a scale">
          <defs>
            <linearGradient id="fl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${palette.getPropertyValue('--color-surface-container-highest').trim()}"/><stop offset="1" stop-color="${palette.getPropertyValue('--color-outline').trim()}"/></linearGradient>
            <linearGradient id="tw" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${palette.getPropertyValue('--color-surface-container-low').trim()}"/><stop offset="1" stop-color="${palette.getPropertyValue('--color-outline-variant').trim()}"/></linearGradient>
          </defs>
          <rect width="343" height="150" fill="url(#fl)"/>
          <rect y="112" width="343" height="38" fill="${palette.getPropertyValue('--color-outline').trim()}" opacity=".5"/>
          <rect x="72" y="104" width="200" height="30" rx="6" fill="${palette.getPropertyValue('--color-on-surface').trim()}"/>
          <rect x="82" y="108" width="180" height="6" rx="3" fill="${palette.getPropertyValue('--color-on-surface-variant').trim()}"/>
          <rect x="262" y="62" width="62" height="32" rx="4" fill="${palette.getPropertyValue('--color-on-surface').trim()}"/>
          <rect x="266" y="66" width="54" height="24" rx="2" fill="${palette.getPropertyValue('--color-primary').trim()}"/>
          <text x="293" y="85" text-anchor="middle" font-family="monospace" font-weight="700" font-size="17" fill="${palette.getPropertyValue('--color-lime').trim()}">8.2</text>
          <path d="M96 52h152l-10 54H106z" fill="${palette.getPropertyValue('--color-surface-container-lowest').trim()}"/>
          <path d="M96 52h152l-3 16H99z" fill="${palette.getPropertyValue('--color-surface-container-high').trim()}"/>
          <g stroke="${palette.getPropertyValue('--color-outline-variant').trim()}" stroke-width="2"><path d="M114 72v32M134 72v32M154 72v32M174 72v32M194 72v32M214 72v32M234 72v32"/></g>
          <path d="M100 52c10-22 36-28 56-20 14-10 44-8 56 6 14-4 30 4 34 14z" fill="url(#tw)"/>
          <path d="M120 40c12-6 24-6 36 0M180 34c10-4 22-2 30 4" stroke="${palette.getPropertyValue('--color-outline').trim()}" stroke-width="2" fill="none" opacity=".7"/>
        </svg>`)
const open = ref(true)
const machineId = ref<string | null>('WSH15-01')
const tagCode = ref<string | null>('B')
const products: WashProductDto[] = [
  { id: 'DET-A', type: 'DETERGENT', name: 'Detergent A', status: 'ACTIVE', sortOrder: 1, note: null },
  { id: 'DET-B', type: 'DETERGENT', name: 'Detergent B', status: 'ACTIVE', sortOrder: 2, note: null },
  { id: 'DET-C', type: 'DETERGENT', name: 'Ecolab Turbo Oxi Booster', status: 'ACTIVE', sortOrder: 3, note: null },
  { id: 'SOF-01', type: 'SOFTENER', name: 'Softener', status: 'ACTIVE', sortOrder: 4, note: null },
  { id: 'BLC-01', type: 'BLEACH', name: 'Bleach', status: 'ACTIVE', sortOrder: 5, note: null },
  { id: 'PRD-06', type: 'DETERGENT', name: 'Oil remover', status: 'ACTIVE', sortOrder: 6, note: null },
  { id: 'PRD-07', type: 'BLEACH', name: 'Oxygen bleach', status: 'ACTIVE', sortOrder: 7, note: null },
  { id: 'PRD-08', type: 'SOFTENER', name: 'Towel softener', status: 'ACTIVE', sortOrder: 8, note: null },
]
const programs: WashProgramDto[] = [
  { id: 'SPA', name: 'Spa', status: 'ACTIVE', sortOrder: 1, steps: [
    { type: 'quick_wash', products: ['DET-A'], temperature: 'cold' },
    { type: 'rinse', products: [] },
    { type: 'soak', products: [], duration: 'overnight' },
    { type: 'normal_wash', products: ['DET-B', 'DET-C'], temperature: '60' },
    { type: 'rinse', products: [] },
    { type: 'rinse', products: ['SOF-01'] },
  ] },
  { id: 'NORMAL', name: 'Normal', status: 'ACTIVE', sortOrder: 2, steps: [
    { type: 'normal_wash', products: ['DET-A'], temperature: 'cold' },
    { type: 'rinse', products: [] }, { type: 'rinse', products: ['SOF-01'] },
  ] },
  { id: 'WHITE', name: 'White', status: 'ACTIVE', sortOrder: 3, steps: [
    { type: 'normal_wash', products: ['DET-A', 'BLC-01'], temperature: '60' },
    { type: 'rinse', products: [] }, { type: 'rinse', products: [] },
  ] },
]
const washOptions = ref<WashOptions>(defaultWashOptions(programs))
const productName = (id: string): string => products.find((product) => product.id === id)?.name ?? id
const status = ref<string | null>(null)
</script>

<template>
  <div class="p-4">
    <button type="button" class="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-on-primary" @click="open = true; status = null">Open booking dialog</button>
    <p v-if="status" class="mt-3 text-sm text-on-surface-variant">{{ status }}</p>
    <WashQueueBookDialog
      :open="open" :photo-url="photoUrl" :weight="8.2" :machines="machines" :machine-id="machineId" :tag-code="tagCode"
      :wash-options="washOptions" :programs="programs" :products="products" :product-name="productName" :error="null" :saving="false" :confirm-disabled="!machineId || !tagCode"
      @close="open = false" @confirm="open = false; status = `Preview only, nothing saved: ${machineId} tag ${tagCode}`" @reweigh="status = 'Re-weigh pressed'"
      @update:machine-id="machineId = $event" @update:tag-code="tagCode = $event" @update:wash-options="washOptions = $event"
    />
  </div>
</template>
