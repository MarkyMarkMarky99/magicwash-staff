<template>
  <nav class="sticky bottom-0 z-40 w-full border-t border-border-light bg-white/90 backdrop-blur-lg dark:border-border-dark dark:bg-surface-dark/90">
    <div class="grid h-16 grid-cols-4">
      <button
        v-for="item in items"
        :key="item.view"
        :class="[
          'flex flex-col items-center justify-center gap-1 transition-colors',
          activeView === item.view ? 'text-primary' : 'text-slate-400 hover:text-primary',
        ]"
        type="button"
        @click="$emit('navigate', item.view)"
      >
        <span class="material-symbols-outlined text-[24px]">{{ item.icon }}</span>
        <span class="text-[10px] font-medium">{{ item.label }}</span>
      </button>
    </div>
  </nav>
</template>

<script setup>
defineProps({
  activeView: {
    type: String,
    required: true,
  },
})

defineEmits(['navigate'])

const items = [
  { view: 'home', icon: 'home', label: 'Home' },
  { view: 'tasks', icon: 'task', label: 'Tasks' },
  { view: 'stats', icon: 'bar_chart', label: 'Stats' },
  { view: 'profile', icon: 'person', label: 'Profile' },
]
</script>
