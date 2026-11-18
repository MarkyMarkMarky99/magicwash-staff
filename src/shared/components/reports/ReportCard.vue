<script setup lang="ts">
defineProps<{ title: string; hint?: string; headingId: string }>()
</script>

<template>
  <section class="mx-4 mt-3 flex flex-col gap-2.5 rounded-[20px] border border-on-primary/10 bg-on-primary/5 p-4" :aria-labelledby="headingId">
    <div class="flex items-baseline justify-between">
      <h3 :id="headingId" class="text-[15px] font-bold">{{ title }}</h3>
      <span v-if="hint" class="text-[12px] text-on-primary/60">{{ hint }}</span>
    </div>
    <slot />
  </section>
</template>
