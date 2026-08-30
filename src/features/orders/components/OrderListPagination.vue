<script setup lang="ts">
defineProps<{ page: number }>()
</script>

<template>
  <p class="border-t border-outline-variant/20 bg-surface-container-low px-4 py-3 font-label text-[10px] font-bold tracking-wide text-on-surface-variant">หน้า {{ page }}</p>
</template>
