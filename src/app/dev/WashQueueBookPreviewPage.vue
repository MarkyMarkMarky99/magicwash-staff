<script setup lang="ts">
import { ref } from 'vue'
import type { MachineDto } from '@/data/machines/machines.service'
import type { WashProductDto } from '@/data/wash-products/wash-products.service'
import { defaultWashOptions, type WashOptions } from '@/features/wash-queue/wash-options'
import WashQueueBookDialog from '@/features/wash-queue/components/WashQueueBookDialog.vue'

defineOptions({ name: 'WashQueueBookPreviewPage' })

// Dev-only: shows the booking dialog with sample data. Nothing is uploaded or saved.
const machines: MachineDto[] = [
  { id: 'WSH10-01', type: 'WSH', name: 'Washer 10', capacityKg: 10, status: 'ACTIVE', sortOrder: 1, note: null },
  { id: 'WSH15-01', type: 'WSH', name: 'Washer 15', capacityKg: 15, status: 'ACTIVE', sortOrder: 2, note: null },
  { id: 'WSH20-01', type: 'WSH', name: 'Washer 20', capacityKg: 20, status: 'ACTIVE', sortOrder: 3, note: null },
]
const photoUrl = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="160"><rect width="400" height="160" fill="#cfd8d3"/><text x="200" y="88" font-size="20" text-anchor="middle" fill="#004d40">Sample basket photo</text></svg>')
const open = ref(true)
const machineId = ref<string | null>(null)
const tagCode = ref<string | null>(null)
const products: WashProductDto[] = [
  { id: 'DET-01', type: 'DETERGENT', name: 'Detergent one', status: 'ACTIVE', sortOrder: 1, note: null },
  { id: 'DET-02', type: 'DETERGENT', name: 'Detergent two', status: 'ACTIVE', sortOrder: 2, note: null },
  { id: 'SOF-01', type: 'SOFTENER', name: 'Softener', status: 'ACTIVE', sortOrder: 1, note: null },
  { id: 'BLC-01', type: 'BLEACH', name: 'Bleach', status: 'ACTIVE', sortOrder: 1, note: null },
]
const washOptions = ref<WashOptions>(defaultWashOptions(products))
const status = ref<string | null>(null)
</script>

<template>
  <div class="p-4">
    <button type="button" class="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-on-primary" @click="open = true; status = null">Open booking dialog</button>
    <p v-if="status" class="mt-3 text-sm text-on-surface-variant">{{ status }}</p>
    <WashQueueBookDialog
      :open="open" :photo-url="photoUrl" :weight="8.2" :machines="machines" :machine-id="machineId" :tag-code="tagCode"
      :wash-options="washOptions" :detergents="products.filter(product => product.type === 'DETERGENT')" :softeners="products.filter(product => product.type === 'SOFTENER')" :bleaches="products.filter(product => product.type === 'BLEACH')" :error="null" :saving="false" :confirm-disabled="!machineId || !tagCode"
      @close="open = false" @confirm="open = false; status = `Preview only, nothing saved: ${machineId} tag ${tagCode}`" @reweigh="status = 'Re-weigh pressed'"
      @update:machine-id="machineId = $event" @update:tag-code="tagCode = $event" @update:wash-options="washOptions = $event"
    />
  </div>
</template>
