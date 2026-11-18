<script setup lang="ts">
withDefaults(defineProps<{
  /** `range` is a plain uppercase caption; `navigator` is a boxed month switcher. */
  variant: 'range' | 'navigator'
  label: string
  sectionLabel: string
  /** Hides the arrows when the period cannot move. */
  navigable?: boolean
  previousLabel?: string
  nextLabel?: string
  canNext?: boolean
}>(), { navigable: true, previousLabel: 'Previous', nextLabel: 'Next', canNext: true })
const emit = defineEmits<{ step: [direction: -1 | 1] }>()
</script>

<template>
  <section class="px-4 pt-4" :aria-label="sectionLabel">
    <div
      v-if="variant === 'range'"
      class="grid items-center"
      :class="navigable ? 'grid-cols-[44px_minmax(0,1fr)_44px]' : 'grid-cols-1'"
    >
      <button v-if="navigable" type="button" :aria-label="previousLabel" class="flex h-11 w-11 items-center justify-center rounded-xl text-on-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime" @click="emit('step', -1)">
        <span class="material-symbols-outlined" aria-hidden="true">chevron_left</span>
      </button>
      <span class="text-center text-[12px] font-semibold uppercase tracking-[0.12em] text-on-primary/60">{{ label }}</span>
      <button v-if="navigable" type="button" :aria-label="nextLabel" :disabled="!canNext" class="flex h-11 w-11 items-center justify-center rounded-xl text-on-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime disabled:opacity-30" @click="emit('step', 1)">
        <span class="material-symbols-outlined" aria-hidden="true">chevron_right</span>
      </button>
    </div>
    <div v-else class="grid grid-cols-[44px_minmax(0,1fr)_44px] items-center rounded-2xl border border-on-primary/10 bg-on-primary/5">
      <button type="button" :aria-label="previousLabel" class="flex h-11 w-11 items-center justify-center rounded-xl text-on-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime" @click="emit('step', -1)">
        <span class="material-symbols-outlined" aria-hidden="true">chevron_left</span>
      </button>
      <span class="text-center text-[13px] font-bold">{{ label }}</span>
      <button type="button" :aria-label="nextLabel" :disabled="!canNext" class="flex h-11 w-11 items-center justify-center rounded-xl text-on-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime disabled:opacity-30" @click="emit('step', 1)">
        <span class="material-symbols-outlined" aria-hidden="true">chevron_right</span>
      </button>
    </div>
  </section>
</template>
