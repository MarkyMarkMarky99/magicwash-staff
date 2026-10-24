<script setup lang="ts">
import CustomerTabCard from '@/shared/components/CustomerTabCard.vue'
import FormPageHeader from '@/shared/components/FormPageHeader.vue'

defineProps<{
  customerName: string | null
  customerSub: string | null
  loading: boolean
  problem: string | null
}>()
const emit = defineEmits<{ close: [] }>()
</script>

<template>
  <FormPageHeader eyebrow="Customer garments" title="Register garments" @close="emit('close')">
    <CustomerTabCard
      :customer-name="customerName"
      :customer-sub="customerSub"
      :loading="loading"
      :problem="problem"
    />
  </FormPageHeader>
</template>
