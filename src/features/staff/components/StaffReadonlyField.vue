<script setup lang="ts">
import FormLabel from '@/shared/components/FormLabel.vue'

defineProps<{
  id: string
  label: string
  value: string
}>()
</script>

<template>
  <section>
    <FormLabel :input-id="id">{{ label }}</FormLabel>
    <input :id="id" :value="value" type="text" readonly class="staff-readonly-field" />
  </section>
</template>

<style scoped>
.staff-readonly-field {
  display: block;
  width: 100%;
  min-width: 0;
  height: 47px;
  padding: 0 12px;
  color: var(--color-on-surface-variant);
  border: 1px solid var(--color-outline-variant);
  border-radius: 10px;
  outline: 0;
  background: var(--color-surface-container-low);
  font-family: 'Noto Sans Thai', system-ui, sans-serif;
  font-size: 14px;
}
</style>
