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
    class="relative z-10 -mt-6 shrink-0 rounded-t-3xl bg-primary px-2 pt-3 pb-[max(0.375rem,env(safe-area-inset-bottom))] text-on-primary shadow-[0_-4px_16px_color-mix(in_srgb,_black_12%,_transparent)]"
    :aria-label="ariaLabel"
  >
    <ul class="flex items-stretch">
      <li v-for="item in items" :key="item.key" class="min-w-0 flex-1">
        <button
          type="button"
          class="nav-item"
          :class="{ 'is-active': item.key === activeKey }"
          :aria-current="item.key === activeKey ? 'page' : undefined"
          @click="emit('select', item.key)"
        >
          <span :key="item.key === activeKey ? `${item.key}-on` : item.key" class="nav-icon">
            <slot name="icon" :item="item" :active="item.key === activeKey">
              <span class="material-symbols-outlined text-[22px] leading-none" aria-hidden="true">{{ item.icon }}</span>
            </slot>
          </span>
          <span class="nav-label">{{ item.label }}</span>
        </button>
      </li>
    </ul>
  </nav>
</template>

<style scoped>
/* Inactive: thin outline icon + light label. Active: the icon floats up on a tilted lime sticker above the bar edge. */
.nav-item {
  display: flex;
  width: 100%;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  padding: 0 2px 4px;
  color: color-mix(in srgb, var(--color-on-primary) 70%, transparent);
  font-family: Manrope, var(--font-label);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: .01em;
  line-height: 1.1;
  transition: color 160ms ease;
}

.nav-item:focus {
  outline: none;
}

.nav-item:not(.is-active):hover {
  color: var(--color-on-primary);
}

.nav-icon {
  display: grid;
  width: 40px;
  height: 40px;
  place-items: center;
  border-radius: 15px;
}

.nav-icon :deep(svg) {
  width: 24px;
  height: 24px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2.4;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.nav-item:focus-visible .nav-icon {
  box-shadow: 0 0 0 2px var(--color-lime);
}

.nav-label {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.nav-item.is-active {
  color: var(--color-lime);
}

.nav-item.is-active .nav-icon {
  width: 46px;
  height: 46px;
  margin-top: -30px;
  background: var(--color-lime);
  color: var(--color-primary);
  box-shadow: 3px 3px 0 color-mix(in srgb, var(--color-primary) 70%, black);
  transform: rotate(-7deg);
  animation: nav-float-pop 420ms cubic-bezier(.2, 1.5, .4, 1) both;
}

.nav-item.is-active .nav-icon > * {
  transform: rotate(7deg);
}

.nav-item.is-active .nav-icon :deep(svg) {
  width: 26px;
  height: 26px;
  stroke-width: 2.8;
}

.nav-item.is-active .nav-label {
  margin-top: 24px;
  font-weight: 800;
}

@keyframes nav-float-pop {
  0% { transform: translateY(22px) rotate(-7deg) scale(.8); }
  60% { transform: translateY(-5px) rotate(-7deg) scale(1.06); }
  100% { transform: translateY(0) rotate(-7deg) scale(1); }
}

@media (prefers-reduced-motion: reduce) {
  .nav-item.is-active .nav-icon {
    animation: none;
  }
}
</style>
