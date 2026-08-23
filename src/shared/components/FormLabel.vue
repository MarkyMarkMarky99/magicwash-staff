<script setup lang="ts">
defineProps<{
  inputId: string
}>()
</script>

<template>
  <label :for="inputId" class="form-label">
    <slot />
  </label>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@500;600;700;800&family=Noto+Sans+Thai:wght@400;500;600;700&display=swap');

.form-label {
  display: block;
  margin-bottom: 6px;
  font-family: 'Noto Sans Thai', system-ui, sans-serif;
  font-size: 12px;
  font-weight: 700;
  color: #234f49;
}
</style>
