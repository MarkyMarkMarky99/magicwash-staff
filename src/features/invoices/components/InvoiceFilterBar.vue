<script setup lang="ts">
import GenericTabs from '@/shared/components/GenericTabs.vue'
import type { InvoiceFilter } from '../types/invoice-filter.types'
import type { InvoiceStatusDto } from '../types/invoices.types'

interface FilterTab {
  key: string
  label: string
  count?: number
}

// Status tabs only. The date filter lives in the ListContainer search row now -- see
// InvoiceDateFilter / InvoiceDatePanel -- so this no longer needs the old global search flag.
defineProps<{
  filter: InvoiceFilter
  tabs: FilterTab[]
}>()

const emit = defineEmits<{
  filterChange: [payload: Partial<InvoiceFilter>]
}>()

function updateStatus(status: string) {
  emit('filterChange', {
    status: status === 'all' ? null : (status as InvoiceStatusDto),
  })
}
</script>

<template>
  <section class="shrink-0 bg-white border-b border-outline-variant/20">
    <div class="bg-primary text-on-primary">
      <GenericTabs
        :tabs="tabs"
        :active-key="filter.status ?? 'all'"
        @select="updateStatus"
      />
    </div>

  </section>
</template>
