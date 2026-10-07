<script setup lang="ts">
import { SHOP_LINE_ID, SHOP_LINE_URL, SHOP_PHONE, SHOP_PHONE_URL } from '../utils/delivery-tracking'

withDefaults(defineProps<{
  tagId?: string
  showQuestions?: boolean
}>(), {
  tagId: undefined,
  showQuestions: false,
})

const LINK_CLASS = 'font-semibold text-primary-container hover:underline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-lime'
</script>

<template>
  <footer class="mt-auto flex flex-wrap justify-between gap-x-4 gap-y-1.5 border-t border-outline-variant bg-surface-container-lowest p-4 text-[13px] text-on-surface-variant">
    <p class="m-0 w-full text-on-surface">
      <template v-if="showQuestions">Questions? </template>LINE
      <a :href="SHOP_LINE_URL" :class="LINK_CLASS">{{ SHOP_LINE_ID }}</a>
      ·
      <a :href="SHOP_PHONE_URL" :class="LINK_CLASS">{{ SHOP_PHONE }}</a>
    </p>
    <span v-if="tagId" class="font-mono text-xs">Tag {{ tagId }}</span>
  </footer>
</template>
