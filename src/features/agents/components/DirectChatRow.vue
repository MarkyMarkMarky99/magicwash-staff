<script setup lang="ts">
import { computed } from 'vue'
import type { DirectChatInbox } from '@/data/direct-chat/direct-chat.service'
import { formatRelativeTime } from '../utils/format-relative-time'

const props = defineProps<{ conversation: DirectChatInbox[number] }>()
defineEmits<{ open: [] }>()

const initial = computed(() => Array.from(props.conversation.peer.name.trim())[0]?.toUpperCase() ?? '?')
const preview = computed(() => {
  const { text, hasImages } = props.conversation.last
  if (text.trim()) return text
  return hasImages ? 'Photo' : ''
})
</script>

<template>
  <button type="button" class="grid min-h-[68px] w-full grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-3 rounded-[14px] bg-white py-2.5 pl-3 pr-2 text-left shadow-[0_1px_0_color-mix(in_srgb,var(--color-on-surface)_5%,transparent)] transition-transform active:scale-[0.985] focus-visible:outline-2 focus-visible:outline-lime" @click="$emit('open')">
    <span class="grid h-12 w-12 place-items-center rounded-full bg-secondary-container font-headline text-lg font-extrabold text-primary" aria-hidden="true">{{ initial }}</span>
    <span class="min-w-0">
      <span class="block truncate font-body text-sm font-extrabold leading-snug">{{ conversation.peer.name }}</span>
      <span class="mt-1 flex items-center gap-1 font-label text-[11px] leading-snug text-on-surface-variant" :class="conversation.unread > 0 ? 'font-bold text-on-surface' : ''">
        <span v-if="!conversation.last.text.trim() && conversation.last.hasImages" class="material-symbols-outlined text-[14px]" aria-hidden="true">image</span>
        <span class="line-clamp-1 [overflow-wrap:anywhere]">{{ preview }}</span>
      </span>
    </span>
    <span class="flex flex-col items-end gap-1">
      <span class="font-label text-[10px] font-bold text-on-surface-variant">{{ formatRelativeTime(conversation.last.at) }}</span>
      <span class="flex items-center gap-1">
        <span v-if="conversation.unread > 0" class="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-error px-1.5 text-[11px] font-bold leading-none text-on-error" :aria-label="`${conversation.unread} unread`">{{ conversation.unread > 99 ? '99+' : conversation.unread }}</span>
        <span class="material-symbols-outlined w-5 text-[22px] text-primary opacity-35" aria-hidden="true">chevron_right</span>
      </span>
    </span>
  </button>
</template>
