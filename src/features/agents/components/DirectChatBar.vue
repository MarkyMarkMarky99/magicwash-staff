<script setup lang="ts">
import { computed } from 'vue'
import CloseButton from '@/shared/components/CloseButton.vue'
import { APP_Z_INDEX_CLASS } from '@/shared/layouts/z-index'

const props = defineProps<{ name: string }>()
defineEmits<{ back: [] }>()

const initial = computed(() => Array.from(props.name.trim())[0]?.toUpperCase() ?? '')
</script>

<template>
  <header class="flex w-full min-w-0 flex-none items-center gap-2.5 bg-primary pb-2.5 pl-3.5 pr-3 pt-[calc(0.625rem+env(safe-area-inset-top))] text-on-primary shadow-md" :class="APP_Z_INDEX_CLASS.header">
    <CloseButton icon="arrow_back" label="Back to Chats" tone="onDark" @click="$emit('back')" />
    <span class="grid h-[42px] w-[42px] flex-none place-items-center rounded-full bg-secondary-container font-headline text-lg font-extrabold text-primary ring-2 ring-lime" aria-hidden="true">{{ initial }}</span>
    <div class="min-w-0 flex-1">
      <b class="block truncate font-headline text-base font-extrabold leading-tight">{{ name || 'Chat' }}</b>
      <small class="mt-px block font-label text-[10px] font-extrabold uppercase tracking-[0.08em] text-lime">Direct message</small>
    </div>
  </header>
</template>
