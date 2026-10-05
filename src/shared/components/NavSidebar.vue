<script setup>
import { inject, onScopeDispose, ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { invalidate } from '@/shared/api/response-cache'
import { onUserChanged, signOutUser } from '@/shared/api/firebase-auth'
import { useNavDrawer } from '@/shared/composables/use-nav-drawer'
import { staffAdminKey } from '@/shared/staff-admin'

defineProps({
  open: Boolean
})
const { close } = useNavDrawer()

const router = useRouter()
const route = useRoute()
const signedIn = ref(false)
const isAdmin = inject(staffAdminKey, ref(false))
onScopeDispose(onUserChanged((user) => { signedIn.value = user !== null }))

function navigate(path) {
  // Replace the pushed menu entry so Back returns to the page beneath it.
  void router.replace(path)
}

/** Drop every cached response and reload; clearing alone does not refetch a rendered page. */
function refresh() {
  invalidate()
  window.location.reload()
}

function logout() {
  close()
  void signOutUser()
}
</script>

<template>
  <nav
    class="absolute inset-y-0 left-0 flex h-full w-[calc(min(78%,320px)+40px)] flex-col overflow-y-auto bg-surface text-on-surface"
    :inert="!open"
    :aria-hidden="!open"
  >
      <div class="bg-primary text-on-primary flex items-center justify-between px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))]">
        <span class="flex h-10 items-center text-lg font-headline font-bold tracking-tight">Menu</span>
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
        <li v-if="isAdmin">
          <button
            class="w-full flex items-center gap-4 px-5 py-3 text-left hover:bg-black/5 transition-colors"
            :class="route.path.startsWith('/staff') ? 'text-primary font-semibold' : ''"
            @click="navigate('/staff')"
          >
            <span class="material-symbols-outlined">badge</span>
            <span>พนักงาน</span>
          </button>
        </li>
      </ul>
      <div class="border-t border-outline-variant/20 px-5 pb-1 pt-3 font-label text-xs font-bold uppercase tracking-wider text-on-surface-variant">Departments</div>
      <ul class="flex flex-col pb-2">
        <li v-for="entry in [
          { path: '/departments/washing', label: 'Washing', icon: 'local_laundry_service' },
          { path: '/departments/drycleaning', label: 'Dry Cleaning', icon: 'dry_cleaning' },
          { path: '/departments/ironing', label: 'Ironing', icon: 'iron' },
          { path: '/departments/packaging', label: 'Packaging', icon: 'inventory_2' },
        ]" :key="entry.path">
          <button
            class="w-full flex items-center gap-4 px-5 py-3 text-left hover:bg-black/5 transition-colors"
            :class="route.path === entry.path ? 'text-primary font-semibold' : ''"
            @click="navigate(entry.path)"
          >
            <span class="material-symbols-outlined" aria-hidden="true">{{ entry.icon }}</span>
            <span>{{ entry.label }}</span>
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
        <li>
          <button
            v-if="signedIn"
            class="w-full flex items-center gap-4 px-5 py-3 text-left hover:bg-black/5 transition-colors"
            @click="logout"
          >
            <span class="material-symbols-outlined">logout</span>
            <span>ออกจากระบบ</span>
          </button>
          <button
            v-else
            class="w-full flex items-center gap-4 px-5 py-3 text-left hover:bg-black/5 transition-colors"
            @click="navigate('/login')"
          >
            <span class="material-symbols-outlined">login</span>
            <span>เข้าสู่ระบบ</span>
          </button>
        </li>
      </ul>
  </nav>
</template>
