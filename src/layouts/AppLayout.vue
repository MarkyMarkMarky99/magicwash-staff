<script setup>
import AppHeader from '../components/AppHeader.vue'
</script>

<template>
  <div class="h-full flex flex-col relative overflow-hidden font-body text-on-surface w-full">
    <AppHeader />
    <slot />
  </div>
</template>
