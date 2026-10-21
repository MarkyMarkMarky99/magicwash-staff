<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { MAX_DRAFT_IMAGES, type DraftImage } from '../agent-chat.types'

const props = defineProps<{ text: string; images: DraftImage[]; thinking: boolean }>()
const emit = defineEmits<{ 'update:text': [text: string]; addFiles: [files: File[]]; removeImage: [id: string]; send: [] }>()

const input = ref<HTMLTextAreaElement | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const canSend = computed(() => !props.thinking && (props.text.trim().length > 0 || props.images.length > 0))
const canAttach = computed(() => !props.thinking && props.images.length < MAX_DRAFT_IMAGES)

function fit(): void {
  const el = input.value
  if (!el) return
  el.style.height = '46px'
  el.style.height = `${Math.min(el.scrollHeight, 124)}px`
}

function onInput(event: Event): void {
  emit('update:text', (event.target as HTMLTextAreaElement).value)
}

function onFiles(event: Event): void {
  const target = event.target as HTMLInputElement
  emit('addFiles', Array.from(target.files ?? []))
  target.value = ''
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && canSend.value) {
    event.preventDefault()
    emit('send')
  }
}

watch(() => props.text, () => void nextTick(fit), { immediate: true, flush: 'post' })

defineExpose({ focus: () => input.value?.focus() })
</script>

<template>
  <div class="relative z-20 flex-none border-t border-outline-variant bg-white px-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))] pt-2">
    <div v-if="images.length" class="flex items-center gap-2.5 px-1 pb-2 pt-1">
      <div v-for="image in images" :key="image.id" class="relative h-[60px] w-[60px]">
        <img :src="image.url" alt="รูปที่เลือก" class="h-full w-full rounded-[10px] bg-surface-container object-cover" />
        <button type="button" class="absolute -right-1.5 -top-1.5 grid h-6 w-6 place-items-center rounded-full border-2 border-white bg-primary text-on-primary focus-visible:outline-2 focus-visible:outline-lime" aria-label="ลบรูป" @click="emit('removeImage', image.id)">
          <span class="material-symbols-outlined text-[14px]" aria-hidden="true">close</span>
        </button>
      </div>
      <span class="font-label text-[11px] font-bold text-on-surface-variant">{{ images.length }}/{{ MAX_DRAFT_IMAGES }}</span>
    </div>
    <div class="flex items-end gap-2">
      <button type="button" class="grid h-[46px] w-[46px] flex-none place-items-center rounded-full border-[1.5px] border-outline-variant bg-surface-container-low text-primary focus-visible:outline-2 focus-visible:outline-lime active:bg-secondary-container disabled:opacity-40" aria-label="แนบรูป" :disabled="!canAttach" @click="fileInput?.click()">
        <span class="material-symbols-outlined text-[22px]" aria-hidden="true">add_photo_alternate</span>
      </button>
      <textarea ref="input" rows="1" class="block h-[46px] max-h-[124px] min-w-0 flex-1 resize-none rounded-[23px] border-[1.5px] border-outline-variant bg-surface px-4 py-[11px] font-body text-[14.5px] font-medium leading-normal text-on-surface placeholder:text-on-surface-variant/80 focus:border-primary focus:bg-white focus:outline-none" placeholder="พิมพ์ข้อความ…" aria-label="พิมพ์ข้อความ" :value="text" @input="onInput" @keydown="onKeydown" />
      <button type="button" class="grid h-[46px] w-[46px] flex-none place-items-center rounded-full bg-primary text-lime shadow-[3px_3px_0_color-mix(in_srgb,var(--color-primary)_70%,black)] transition-[transform,box-shadow] focus-visible:outline-2 focus-visible:outline-lime active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0_color-mix(in_srgb,var(--color-primary)_70%,black)] disabled:bg-surface-container disabled:text-on-surface-variant disabled:shadow-none" aria-label="ส่ง" :disabled="!canSend" @click="emit('send')">
        <span class="material-symbols-outlined fill-icon text-[22px]" aria-hidden="true">arrow_upward</span>
      </button>
    </div>
    <input ref="fileInput" type="file" accept="image/*" multiple class="hidden" @change="onFiles" />
  </div>
</template>
