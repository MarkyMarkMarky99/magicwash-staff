<script setup lang="ts">
/**
 * Presentation only. Renders whatever payload/response objects it's handed —
 * it does not build the request, call the service, or hold submit state.
 */
import { ref } from 'vue'

defineProps<{
  payload: unknown
  response: unknown | null
}>()

const open = ref(true)
</script>

<template>
  <section class="rounded-2xl border-2 border-dashed border-tertiary/50 bg-tertiary-container/10">
    <button
      type="button"
      class="flex w-full items-center justify-between gap-2 px-4 py-3"
      @click="open = !open"
    >
      <span class="flex items-center gap-2">
        <span class="rounded-full bg-tertiary px-2 py-0.5 font-label text-[10px] font-bold uppercase tracking-widest text-on-tertiary">
          Dev
        </span>
        <span class="font-label text-[12px] font-semibold text-on-surface-variant">
          Request/response inspector — temporary, remove before shipping
        </span>
      </span>
      <span
        class="material-symbols-outlined text-[18px] text-on-surface-variant transition-transform"
        :class="open ? 'rotate-180' : ''"
        aria-hidden="true"
      >expand_more</span>
    </button>

    <div v-if="open" class="space-y-3 px-4 pb-4">
      <div>
        <p class="mb-1 font-label text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">
          Request payload (live)
        </p>
        <pre class="max-h-64 overflow-auto rounded-lg bg-surface-container-lowest p-3 font-mono text-[11px] leading-relaxed text-on-surface">{{ JSON.stringify(payload, null, 2) }}</pre>
      </div>

      <div v-if="response !== null">
        <p class="mb-1 font-label text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">
          Raw response
        </p>
        <pre class="max-h-64 overflow-auto rounded-lg bg-surface-container-lowest p-3 font-mono text-[11px] leading-relaxed text-on-surface">{{ JSON.stringify(response, null, 2) }}</pre>
      </div>
    </div>
  </section>
</template>
