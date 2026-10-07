<script setup lang="ts">
import { SHOP_LINE_URL, SHOP_PHONE, SHOP_PHONE_URL } from '../utils/delivery-tracking'

defineProps<{
  orderImageId: string
}>()
</script>

<template>
  <section class="px-4 pb-9 pt-11" aria-labelledby="delivery-tracking-not-found-heading">
    <div class="-ml-4 inline-block rounded-r-[10px] bg-black py-2.5 pl-4 pr-[18px] text-white">
      <b class="heavy text-[40px] leading-none tracking-[-0.02em]" aria-hidden="true">?</b>
    </div>
    <h1 id="delivery-tracking-not-found-heading" class="mb-2 mt-[22px] text-2xl font-bold leading-tight">This tag isn’t in our system</h1>
    <p class="mb-2 mt-0 max-w-[32ch] text-on-surface-variant">The code may have been mistyped, or the photo was removed. Try scanning the tag on your bag again.</p>
    <code class="mb-6 mt-1.5 inline-block break-all rounded-md border border-dashed border-outline-variant bg-surface-container-lowest px-2 py-1 font-mono text-[13px] text-on-surface">/b/{{ orderImageId }}</code>
    <div class="flex flex-wrap gap-2.5">
      <a
        :href="SHOP_LINE_URL"
        class="inline-flex min-h-[46px] items-center rounded-xl border-2 border-primary bg-primary px-[18px] text-[15px] font-semibold text-on-primary no-underline hover:border-primary-container hover:bg-primary-container focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-lime"
      >Message us on LINE</a>
      <a
        :href="SHOP_PHONE_URL"
        class="inline-flex min-h-[46px] items-center rounded-xl border-2 border-primary bg-transparent px-[18px] text-[15px] font-semibold text-primary no-underline hover:border-primary-container hover:bg-primary-container hover:text-on-primary focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-lime"
      >Call {{ SHOP_PHONE }}</a>
    </div>
  </section>
</template>

<style scoped>
.heavy {
  font-family: "Arial Black", "Archivo Black", Arial, sans-serif;
}
</style>
