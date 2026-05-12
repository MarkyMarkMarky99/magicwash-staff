<script setup>
import { useRouter, useRoute } from 'vue-router'

const props = defineProps({
  open: Boolean
})
const emit = defineEmits(['close'])

const router = useRouter()
const route = useRoute()

function navigate(path) {
  router.push(path)
  emit('close')
}
</script>

<template>
  <!-- Backdrop -->
  <Transition name="backdrop">
    <div
      v-if="open"
      class="fixed inset-0 bg-black/40 z-40"
      @click="emit('close')"
    />
  </Transition>

  <!-- Sidebar panel -->
  <Transition name="slide">
    <nav
      v-if="open"
      class="fixed top-0 left-0 h-full w-[75%] max-w-sm bg-surface text-on-surface z-50 flex flex-col shadow-2xl"
    >
      <!-- Header -->
      <div class="bg-primary text-on-primary flex items-center justify-between px-4 py-3">
        <span class="text-lg font-headline font-bold tracking-tight">Menu</span>
        <button
          class="material-symbols-outlined hover:bg-white/10 rounded-full transition-colors p-1"
          aria-label="Close menu"
          @click="emit('close')"
        >close</button>
      </div>

      <!-- Nav items -->
      <ul class="flex flex-col py-2">
        <li>
          <button
            class="w-full flex items-center gap-4 px-5 py-3 text-left hover:bg-black/5 transition-colors"
            :class="route.path === '/' ? 'text-primary font-semibold' : ''"
            @click="navigate('/')"
          >
            <span class="material-symbols-outlined">home</span>
            <span>Home</span>
          </button>
        </li>
        <li>
          <button
            class="w-full flex items-center gap-4 px-5 py-3 text-left hover:bg-black/5 transition-colors"
            :class="route.path === '/customers' ? 'text-primary font-semibold' : ''"
            @click="navigate('/customers')"
          >
            <span class="material-symbols-outlined">group</span>
            <span>Customers</span>
          </button>
        </li>
        <li>
          <button
            class="w-full flex items-center gap-4 px-5 py-3 text-left hover:bg-black/5 transition-colors"
            :class="route.path === '/pending' ? 'text-primary font-semibold' : ''"
            @click="navigate('/pending')"
          >
            <span class="material-symbols-outlined">pending_actions</span>
            <span>Pending</span>
          </button>
        </li>
      </ul>
    </nav>
  </Transition>
</template>

<style scoped>
.backdrop-enter-active,
.backdrop-leave-active {
  transition: opacity 0.25s ease;
}
.backdrop-enter-from,
.backdrop-leave-to {
  opacity: 0;
}

.slide-enter-active,
.slide-leave-active {
  transition: transform 0.25s ease;
}
.slide-enter-from,
.slide-leave-to {
  transform: translateX(-100%);
}
</style>
