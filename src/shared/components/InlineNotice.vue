<script setup lang="ts">
type NoticeTone = 'success' | 'warning' | 'error' | 'info'

const props = withDefaults(
  defineProps<{
    tone: NoticeTone
    size?: 'sm' | 'md'
    icon?: string
    dismissible?: boolean
  }>(),
  { size: 'md', icon: undefined, dismissible: false },
)

defineEmits<{ dismiss: [] }>()

const toneClasses: Record<NoticeTone, string> = {
  success: 'bg-success-container text-on-success-container',
  warning: 'bg-warning-container text-on-warning-container',
  error: 'bg-error-container text-on-error-container',
  info: 'bg-info-container text-on-info-container',
}
</script>

<template>
  <div
    :role="props.tone === 'error' ? 'alert' : 'status'"
    class="flex gap-2 rounded-xl text-sm"
    :class="[toneClasses[props.tone], props.size === 'sm' ? 'items-start px-3 py-2' : 'items-center px-4 py-3 font-body']"
  >
    <span v-if="props.icon && props.size === 'md'" class="material-symbols-outlined shrink-0 text-[18px]" aria-hidden="true">{{ props.icon }}</span>
    <span v-if="props.size === 'sm'" class="flex-1 font-semibold"><slot /></span>
    <slot v-else />
    <button v-if="props.dismissible" type="button" class="shrink-0 rounded p-0.5 focus-visible:outline-2 focus-visible:outline-lime" aria-label="Dismiss notice" @click="$emit('dismiss')">
      <span class="material-symbols-outlined text-[16px]" aria-hidden="true">close</span>
    </button>
  </div>
</template>
