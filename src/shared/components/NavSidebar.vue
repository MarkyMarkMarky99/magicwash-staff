<script setup>
import { useRouter, useRoute } from 'vue-router'
import { invalidate } from '@/shared/api/response-cache'
import { APP_Z_INDEX_CLASS } from '@/shared/layouts/z-index'

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

/** Drop every cached response and reload; clearing alone does not refetch a rendered page. */
function refresh() {
  invalidate()
  window.location.reload()
}
</script>

<template>
  <Transition name="backdrop">
    <div
      v-if="open"
      class="fixed inset-0 bg-black/40"
      :class="APP_Z_INDEX_CLASS.navigationScrim"
      @click="emit('close')"
    />
  </Transition>

  <Transition name="slide">
    <nav
      v-if="open"
      class="fixed top-0 left-0 h-full w-[75%] max-w-sm bg-surface text-on-surface flex flex-col shadow-2xl"
      :class="APP_Z_INDEX_CLASS.navigation"
    >
      <div class="bg-primary text-on-primary flex items-center justify-between px-4 py-3">
        <span class="text-lg font-headline font-bold tracking-tight">Menu</span>
        <button
          class="material-symbols-outlined hover:bg-white/10 rounded-full transition-colors p-1"
          aria-label="Close menu"
          @click="emit('close')"
        >close</button>
      </div>

      <ul class="flex flex-col py-2">
        <li>
          <button
            class="w-full flex items-center gap-4 px-5 py-3 text-left hover:bg-black/5 transition-colors"
            :class="route.path === '/' ? 'text-primary font-semibold' : ''"
            @click="navigate('/')"
          >
            <span class="material-symbols-outlined">home</span>
            <span>Appointments</span>
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
            :class="route.path.startsWith('/orders') ? 'text-primary font-semibold' : ''"
            @click="navigate('/orders')"
          >
            <span class="material-symbols-outlined">local_laundry_service</span>
            <span>Orders</span>
          </button>
        </li>
        <li>
          <button
            class="w-full flex items-center gap-4 px-5 py-3 text-left hover:bg-black/5 transition-colors"
            :class="route.path.startsWith('/customer-packages') ? 'text-primary font-semibold' : ''"
            @click="navigate('/customer-packages')"
          >
            <span class="material-symbols-outlined">redeem</span>
            <span>Customer packages</span>
          </button>
        </li>
        <li>
          <button
            class="w-full flex items-center gap-4 px-5 py-3 text-left hover:bg-black/5 transition-colors"
            :class="route.path === '/invoices' ? 'text-primary font-semibold' : ''"
            @click="navigate('/invoices')"
          >
            <span class="material-symbols-outlined">receipt_long</span>
            <span>Invoices</span>
          </button>
        </li>
        <li>
          <button
            class="w-full flex items-center gap-4 px-5 py-3 text-left hover:bg-black/5 transition-colors"
            :class="route.path === '/price-list' ? 'text-primary font-semibold' : ''"
            @click="navigate('/price-list')"
          >
            <span class="material-symbols-outlined">sell</span>
            <span>รายการราคา</span>
          </button>
        </li>
        <li>
          <button
            class="w-full flex items-center gap-4 px-5 py-3 text-left hover:bg-black/5 transition-colors"
            :class="route.path.startsWith('/issue-reports') ? 'text-primary font-semibold' : ''"
            @click="navigate('/issue-reports')"
          >
            <span class="material-symbols-outlined">bug_report</span>
            <span>แจ้งปัญหา</span>
          </button>
        </li>
      </ul>
      <ul class="mt-auto flex flex-col border-t border-outline-variant/20 py-2">
        <li>
          <button
            class="w-full flex items-center gap-4 px-5 py-3 text-left hover:bg-black/5 transition-colors"
            @click="refresh"
          >
            <span class="material-symbols-outlined">refresh</span>
            <span>รีเฟรชข้อมูล</span>
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
