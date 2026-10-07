<template>
  <div role="status" aria-label="Loading your bag">
    <div class="skeleton aspect-[3/4] bg-surface-container-highest" />
    <div class="relative -mt-11 flex items-start gap-4 pr-4">
      <div class="skeleton h-[98px] w-[190px] rounded-r-[10px] bg-outline-variant max-[340px]:w-[150px]" />
      <div class="min-w-0 pt-[52px]">
        <div class="skeleton mb-3 h-2.5 w-7 rounded-md bg-surface-container-highest" />
        <div class="skeleton h-5 w-16 rounded-md bg-surface-container-highest" />
      </div>
    </div>
    <div class="px-4 pb-7 pt-[22px]" aria-hidden="true">
      <div class="skeleton mb-3 h-2.5 w-[120px] rounded-md bg-surface-container-highest" />
      <div class="mb-[26px] grid grid-cols-3 gap-2">
        <div v-for="slot in 3" :key="slot" class="skeleton aspect-[3/4.6] rounded-md bg-surface-container-highest" />
      </div>
      <div class="skeleton mb-5 h-[62px] rounded-xl bg-surface-container-highest" />
      <div class="skeleton mb-3 h-3.5 w-full rounded-md bg-surface-container-highest" />
      <div class="skeleton mb-3 h-3.5 w-[92%] rounded-md bg-surface-container-highest" />
      <div class="skeleton mb-3 h-3.5 w-[84%] rounded-md bg-surface-container-highest" />
      <div class="skeleton mb-3 h-3.5 w-[70%] rounded-md bg-surface-container-highest" />
    </div>
    <span class="sr-only">Loading your bag…</span>
  </div>
</template>

<style scoped>
.skeleton {
  position: relative;
  overflow: hidden;
}

.skeleton::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(100deg, transparent 20%, color-mix(in srgb, white 65%, transparent) 50%, transparent 80%);
  transform: translateX(-100%);
  animation: delivery-tracking-sweep 1.4s ease-in-out infinite;
}

@keyframes delivery-tracking-sweep {
  to { transform: translateX(100%); }
}

@media (prefers-reduced-motion: reduce) {
  .skeleton::after {
    display: none;
    animation: none;
  }
}
</style>
