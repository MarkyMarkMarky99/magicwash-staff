<script setup>
defineProps({
  title:     { type: String,  required: true },
  closeMode: { type: Boolean, default: false },
})
defineEmits(['back', 'close'])
</script>

<template>
  <div class="h-full flex flex-col relative overflow-hidden font-body text-on-surface w-full">

    <!-- Header -->
    <header class="flex-none bg-primary text-on-primary px-4 py-3 flex items-center gap-4 shadow-md z-50">
      <!-- Back mode (default) -->
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

      <!-- Close mode (X on right) -->
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

    <!-- Scrollable body -->
    <main class="flex-1 overflow-y-auto no-scrollbar w-full">
      <slot />
    </main>

    <!-- Sticky footer -->
    <footer v-if="$slots.footer" class="flex-none p-4 bg-surface border-t border-outline-variant/20 z-50">
      <slot name="footer" />
    </footer>

  </div>
</template>
