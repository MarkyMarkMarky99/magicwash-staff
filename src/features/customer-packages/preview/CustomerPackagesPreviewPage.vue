<script setup lang="ts">
import AppLayout from '@/shared/layouts/AppLayout.vue'
import ScrollRegion from '@/shared/components/ScrollRegion.vue'
import CustomerPackagesVariantC from './variant-c/VariantC.vue'
</script>

<template>
  <AppLayout>
    <div class="flex min-h-0 flex-1 flex-col overflow-hidden bg-surface text-on-surface">
      <ScrollRegion as="main">
        <CustomerPackagesVariantC />
      </ScrollRegion>
    </div>
  </AppLayout>
</template>
