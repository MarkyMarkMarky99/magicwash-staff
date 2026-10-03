<script setup lang="ts">
import { computed, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute, useRouter } from 'vue-router'
import CloseButton from '@/shared/components/CloseButton.vue'
import { useCloseRoute } from '@/shared/navigation/use-close-route'
import { staffRegisterRoute } from '@/shared/navigation/form-routes'
import { useAuthStore } from '@/data/auth/auth.store'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const { close } = useCloseRoute('/')
const { status, error, signingIn, email, pendingStaff } = storeToRefs(authStore)
void authStore.ready()

const busy = computed(() => signingIn.value || status.value === 'loading')

function leave(): void {
  const redirect = route.query.redirect
  if (typeof redirect === 'string' && redirect.startsWith('/')) void router.replace(redirect)
  else close()
}

function openRegistration(): void {
  void router.replace(staffRegisterRoute())
}

watch(status, (value) => {
  if (value === 'signedIn') leave()
}, { immediate: true })

// Not immediate: the registration form's Back/close lands here, and must not bounce back to it.
watch(status, (value) => {
  if (value === 'unregistered') openRegistration()
})
</script>

<template>
  <main class="relative flex h-full flex-col items-center justify-center gap-8 bg-primary px-6 text-on-primary">
    <CloseButton class="absolute right-3 top-3" tone="onDark" @click="close" />
    <div class="text-center">
      <p class="font-label text-[11px] font-bold uppercase tracking-[0.18em] text-lime">Staff sign-in</p>
      <h1 class="mt-2 font-headline text-3xl font-bold tracking-tight">Magicwash Laundry</h1>
    </div>

    <div v-if="status === 'pending'" class="flex w-full max-w-xs flex-col items-center gap-3 text-center">
      <span class="material-symbols-outlined text-[40px] leading-none text-lime" aria-hidden="true">hourglass_top</span>
      <p role="status" class="font-headline text-lg font-bold">ลงทะเบียนแล้ว รอผู้ดูแลอนุมัติ</p>
      <p class="font-body text-sm text-on-primary/80">
        {{ pendingStaff?.email ?? email }}<br>เมื่อได้รับอนุมัติแล้ว กรุณาเข้าสู่ระบบอีกครั้ง
      </p>
      <button
        type="button"
        class="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-surface py-3 font-label text-sm font-semibold text-primary shadow-lg transition-all hover:bg-surface-container-low active:scale-[0.98]"
        @click="authStore.signOut"
      >
        <span class="material-symbols-outlined text-[20px] leading-none" aria-hidden="true">logout</span>
        ออกจากระบบ
      </button>
    </div>

    <div v-else-if="status === 'unregistered'" class="flex w-full max-w-xs flex-col items-center gap-3 text-center">
      <p role="status" class="font-headline text-lg font-bold">บัญชีนี้ยังไม่ได้ลงทะเบียนพนักงาน</p>
      <p class="font-body text-sm text-on-primary/80">{{ email }}</p>
      <button
        type="button"
        class="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-surface py-3 font-label text-sm font-semibold text-primary shadow-lg transition-all hover:bg-surface-container-low active:scale-[0.98]"
        @click="openRegistration"
      >
        <span class="material-symbols-outlined text-[20px] leading-none" aria-hidden="true">person_add</span>
        ลงทะเบียนพนักงาน
      </button>
      <button
        type="button"
        class="font-label text-sm font-semibold text-lime underline-offset-4 hover:underline"
        @click="authStore.signOut"
      >
        ออกจากระบบ
      </button>
    </div>

    <div v-else class="flex w-full max-w-xs flex-col items-center gap-3">
      <button
        type="button"
        class="flex w-full items-center justify-center gap-2 rounded-xl bg-surface py-3 font-label text-sm font-semibold text-primary shadow-lg transition-all hover:bg-surface-container-low active:scale-[0.98] disabled:opacity-60"
        :disabled="busy"
        @click="authStore.signIn"
      >
        <span class="material-symbols-outlined text-[20px] leading-none" aria-hidden="true">login</span>
        {{ busy ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบด้วย Google' }}
      </button>
      <p v-if="error" role="alert" class="text-center font-body text-sm text-lime">{{ error }}</p>
    </div>
  </main>
</template>
