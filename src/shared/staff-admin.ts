import type { InjectionKey, Ref } from 'vue'

export const staffAdminKey: InjectionKey<Readonly<Ref<boolean>>> = Symbol('staff-admin')
