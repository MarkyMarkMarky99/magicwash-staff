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
    class="relative z-10 -mt-6 shrink-0 rounded-t-3xl bg-primary px-2 pt-2.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] text-on-primary shadow-[0_-4px_16px_color-mix(in_srgb,_black_12%,_transparent)]"
    :aria-label="ariaLabel"
  >
    <ul class="flex items-stretch">
      <li v-for="item in items" :key="item.key" class="min-w-0 flex-1">
        <button
          type="button"
          class="group flex w-full flex-col items-center gap-1 rounded-2xl px-1 pb-1 focus:outline-none"
          :aria-current="item.key === activeKey ? 'page' : undefined"
          @click="emit('select', item.key)"
        >
          <span
            class="flex h-8 w-14 items-center justify-center rounded-full transition-colors duration-200 group-focus-visible:ring-2 group-focus-visible:ring-lime"
            :class="item.key === activeKey ? 'bg-lime text-primary' : 'text-on-primary/75 group-hover:bg-on-primary/10 group-active:bg-on-primary/15'"
          >
            <span
              class="material-symbols-outlined text-[22px] leading-none [font-variation-settings:'FILL'_0,'wght'_300,'GRAD'_0,'opsz'_24]"
              aria-hidden="true"
            >{{ item.icon }}</span>
          </span>
          <span
            class="max-w-full truncate font-label text-[11px] font-semibold leading-tight transition-colors duration-200"
            :class="item.key === activeKey ? 'text-lime' : 'text-on-primary/75'"
          >{{ item.label }}</span>
        </button>
      </li>
    </ul>
  </nav>
</template>
