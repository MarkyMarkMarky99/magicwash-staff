<script setup lang="ts">
import CloseButton from '@/shared/components/CloseButton.vue'
import { APP_Z_INDEX_CLASS } from '@/shared/layouts/z-index'
import type { AgentInfo } from '../agents'
import AgentAvatar from './AgentAvatar.vue'

defineProps<{ agent: AgentInfo }>()
defineEmits<{ back: []; end: [] }>()
</script>

<template>
  <header class="flex w-full min-w-0 flex-none items-center gap-2.5 bg-primary pb-2.5 pl-3.5 pr-3 pt-[calc(0.625rem+env(safe-area-inset-top))] text-on-primary shadow-md" :class="APP_Z_INDEX_CLASS.header">
    <CloseButton icon="arrow_back" label="Back" tone="onDark" @click="$emit('back')" />
    <span class="rounded-full ring-2 ring-lime"><AgentAvatar :agent-id="agent.id" :size="42" /></span>
    <div class="min-w-0 flex-1">
      <b class="block truncate font-headline text-base font-extrabold leading-tight">{{ agent.name }}</b>
      <small class="mt-px block font-label text-[10px] font-extrabold uppercase tracking-[0.08em] text-lime">{{ agent.role }}</small>
    </div>
    <button type="button" class="inline-flex h-10 items-center gap-1 rounded-[14px_16px_14px_15px] border-2 border-lime px-3.5 font-body text-sm font-extrabold text-lime transition-colors hover:bg-lime hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime active:bg-lime active:text-primary" @click="$emit('end')">
      <span class="material-symbols-outlined text-[18px]" aria-hidden="true">logout</span>จบงาน
    </button>
  </header>
</template>
