<script setup lang="ts">
interface BottomNavItem {
  key: string
  label: string
  icon: string
}

defineProps<{
  items: readonly BottomNavItem[]
  activeKey: string
  ariaLabel: string
}>()

const emit = defineEmits<{
  select: [key: string]
}>()
</script>

<template>
  <nav
    class="shrink-0 rounded-t-3xl bg-primary px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] text-on-primary shadow-[0_-4px_16px_rgba(0,0,0,0.12)]"
    :aria-label="ariaLabel"
  >
    <ul class="flex items-stretch">
      <li v-for="item in items" :key="item.key" class="min-w-0 flex-1">
        <button
          type="button"
          class="flex w-full flex-col items-center gap-0.5 rounded-2xl px-1 py-1.5 transition-colors focus:outline-none focus-visible:bg-on-primary/15 active:bg-on-primary/10"
          :class="item.key === activeKey ? 'text-on-primary' : 'text-on-primary/60 hover:text-on-primary/85'"
          :aria-current="item.key === activeKey ? 'page' : undefined"
          @click="emit('select', item.key)"
        >
          <span
            class="material-symbols-outlined text-[22px] leading-none"
            :class="item.key === activeKey ? 'fill-icon' : ''"
            aria-hidden="true"
          >{{ item.icon }}</span>
          <span
            class="max-w-full truncate font-label text-[11px] leading-tight"
            :class="item.key === activeKey ? 'font-bold' : 'font-medium'"
          >{{ item.label }}</span>
        </button>
      </li>
    </ul>
  </nav>
</template>
