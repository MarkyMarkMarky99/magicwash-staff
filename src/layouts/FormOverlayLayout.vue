<script setup>
defineProps({
  title:       { type: String, required: true },
  submitLabel: { type: String, default: 'Submit' },
  submitIcon:  { type: String, default: 'check_circle' },
  canSubmit:   { type: Boolean, default: false },
  submitting:  { type: Boolean, default: false },
  closeMode:   { type: Boolean, default: false },
})

defineEmits(['back', 'close', 'submit'])
</script>

<template>
  <div class="h-full flex flex-col relative overflow-hidden font-body text-on-surface w-full">

    <header class="flex-none bg-primary text-on-primary px-4 py-3 flex items-center gap-4 shadow-md z-50">
      <template v-if="!closeMode">
        <button
          class="p-1 hover:bg-white/10 rounded-full transition-colors flex items-center justify-center"
          aria-label="Go back"
          @click="$emit('back')"
        >
          <span class="material-symbols-outlined text-2xl">arrow_back</span>
        </button>
        <h1 class="text-lg font-headline font-bold tracking-tight">{{ title }}</h1>
      </template>

      <template v-else>
        <h1 class="text-lg font-headline font-bold tracking-tight flex-1">{{ title }}</h1>
        <button
          class="p-1 hover:bg-white/10 rounded-full transition-colors flex items-center justify-center"
          aria-label="Close"
          @click="$emit('close')"
        >
          <span class="material-symbols-outlined text-2xl">close</span>
        </button>
      </template>
    </header>

    <main class="flex-1 overflow-y-auto no-scrollbar w-full">
      <slot />
    </main>

    <footer class="flex-none p-4 bg-surface border-t border-outline-variant/20 z-50">
      <slot name="footer">
        <button
          :disabled="!canSubmit || submitting"
          class="w-full font-headline font-bold text-[15px] py-4 rounded-xl flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-surface transition-all"
          :class="canSubmit && !submitting
            ? 'bg-primary hover:brightness-110 text-on-primary shadow-[0_4px_12px_rgba(0,79,69,0.2)] active:scale-[0.98]'
            : 'bg-surface-container-high text-on-surface-variant cursor-not-allowed'"
          @click="$emit('submit')"
        >
          <template v-if="submitting">
            <span class="material-symbols-outlined text-[20px] animate-spin">sync</span>
            Saving...
          </template>
          <template v-else>
            <span class="material-symbols-outlined text-[20px]">{{ submitIcon }}</span>
            {{ submitLabel }}
          </template>
        </button>
      </slot>
    </footer>

  </div>
</template>
