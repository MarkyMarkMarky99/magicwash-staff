<script setup lang="ts">
withDefaults(defineProps<{ tab: string, as?: 'div' | 'fieldset' }>(), { as: 'div' })
</script>

<template>
  <component :is="as" class="paper">
    <span class="paper__tab">{{ tab }}</span>
    <slot />
  </component>
</template>

<style scoped>
.paper {
  position: relative;
  min-width: 0;
  padding: 0;
  margin: 22px 4px 6px 2px;
  border: 2px solid var(--color-primary);
  border-radius: 11px 15px 12px 14px;
  background: white;
  box-shadow: 4px 4px 0 color-mix(in srgb, var(--color-primary) 70%, black);
}

.paper__tab {
  position: absolute;
  top: -12px;
  left: 10px;
  z-index: 8;
  padding: 3px 9px 4px;
  border-radius: 6px 8px 6px 7px;
  background: var(--color-primary);
  color: var(--color-on-primary);
  box-shadow: 1px 1px 0 color-mix(in srgb, var(--color-primary) 70%, black);
  font-size: 11px;
  font-weight: 700;
  line-height: 1.1;
  transform: rotate(-3deg);
  pointer-events: none;
}
</style>
