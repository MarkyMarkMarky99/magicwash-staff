<script setup lang="ts">
import { useRouter } from 'vue-router'
import BaseDropdown from '@/shared/components/BaseDropdown.vue'

const router = useRouter()

const actions = [
  { key: 'create', label: 'Create order', icon: 'post_add', to: { name: 'order-create' } },
  { key: 'report', label: 'Orders report', icon: 'bar_chart', to: { path: '/reports/orders' } },
]

function go(to: (typeof actions)[number]['to'], close: () => void) {
  close()
  void router.push(to)
}
</script>

<template>
  <BaseDropdown panel-class="w-48 rounded-2xl border border-outline-variant/30 bg-surface-container-lowest py-1 shadow-2xl">
    <template #trigger="{ setTrigger, toggle, triggerAttrs }">
      <button
        :ref="setTrigger"
        v-bind="triggerAttrs"
        type="button"
        class="-my-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full text-primary transition-colors hover:bg-primary/10 active:bg-primary/20 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime"
        aria-label="Order actions"
        @click="toggle"
      >
        <span class="material-symbols-outlined text-[16px]" aria-hidden="true">more_vert</span>
      </button>
    </template>

    <template #default="{ close }">
      <div class="py-1">
        <button
          v-for="action in actions"
          :key="action.key"
          type="button"
          class="flex w-full items-center gap-2 px-3 py-2 text-left font-body text-[12px] text-on-surface transition-colors hover:bg-surface-container-low focus:bg-surface-container-low focus:outline-none active:bg-surface-container"
          @click="go(action.to, close)"
        >
          <span class="material-symbols-outlined text-[16px] leading-none text-primary" aria-hidden="true">{{ action.icon }}</span>
          {{ action.label }}
        </button>
      </div>
    </template>
  </BaseDropdown>
</template>
