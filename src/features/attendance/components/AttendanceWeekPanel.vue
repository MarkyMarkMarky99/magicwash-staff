<script setup lang="ts">
defineProps<{
  range: string
  mineLabel: string | null
  opensLaterAfter: string | null
}>()
</script>

<template>
  <div v-if="mineLabel" class="flex items-start gap-3 rounded-[14px] bg-success-container p-3.5 text-on-success-container">
    <span class="material-symbols-outlined flex-none text-2xl" aria-hidden="true">event_available</span>
    <div>
      <h3 class="font-headline text-[15px] font-extrabold leading-[1.3] tracking-[-0.01em]">You're off on {{ mineLabel }}</h3>
      <p class="mt-0.5 text-[12.5px] leading-[1.45]">That is your day off for {{ range }}. Need to change it? Ask an admin.</p>
    </div>
  </div>
  <div v-else class="flex items-start gap-3 rounded-[14px] bg-info-container p-3.5 text-on-info-container">
    <span class="material-symbols-outlined flex-none text-2xl" aria-hidden="true">touch_app</span>
    <div>
      <h3 class="font-headline text-[15px] font-extrabold leading-[1.3] tracking-[-0.01em]">Pick your day off for {{ range }}</h3>
      <p class="mt-0.5 text-[12.5px] leading-[1.45]">You get one this week. Tap a free day to book it.<template v-if="opensLaterAfter"> Days after {{ opensLaterAfter }} open up later.</template> Once booked, only an admin can change it.</p>
    </div>
  </div>
</template>
