<script setup>
import { computed } from 'vue'
import { useCustomerStore } from '../composables/useCustomerStore'
import GenericTabs from './shared/GenericTabs.vue'

defineProps({
  activeType: { type: String, required: true },
})
const emit = defineEmits(['typeSelect'])

const { CUSTOMER_TYPES, customerCounts } = useCustomerStore()

const tabs = computed(() =>
  CUSTOMER_TYPES.map(tab => ({
    ...tab,
    count: customerCounts.value[tab.key],
  }))
)
</script>

<template>
  <GenericTabs
    :tabs="tabs"
    :active-key="activeType"
    @select="emit('typeSelect', $event)"
  />
</template>
