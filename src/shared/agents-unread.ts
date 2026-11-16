import type { InjectionKey, Ref } from 'vue'

export const agentsUnreadKey: InjectionKey<Readonly<Ref<number>>> = Symbol('agents-unread')
