<script setup lang="ts">
import { computed } from 'vue'
import { customerTypeSchema } from '@contracts/customers/customer-api.schema'
import GenericTabs from '@/shared/components/GenericTabs.vue'

const props = defineProps<{
  activeType: string
  counts: Record<string, number>
}>()

const emit = defineEmits<{
  select: [key: string]
}>()

const TYPE_TABS: ReadonlyArray<{ key: string; label: string }> = [
  { key: 'all', label: 'All' },
  ...customerTypeSchema.options.map((type) => ({ key: type, label: type })),
]

const tabs = computed(() =>
  TYPE_TABS.map((tab) => ({ ...tab, count: props.counts[tab.key] ?? 0 })),
)
</script>

<template>
  <GenericTabs :tabs="tabs" :active-key="activeType" @select="emit('select', $event)" />
</template>
