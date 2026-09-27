import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth'
import { auth } from '@/firebase'

let firstState: Promise<User | null> | null = null

/** Resolves once Firebase has restored (or ruled out) the persisted session. */
export function authReady(): Promise<User | null> {
  firstState ??= new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe()
      resolve(user)
    })
  })
  return firstState
}

export function onUserChanged(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, callback)
}

export async function signInWithGoogle(): Promise<void> {
  const provider = new GoogleAuthProvider()
  provider.setCustomParameters({ prompt: 'select_account' })
  await signInWithPopup(auth, provider)
}

export async function signOutUser(): Promise<void> {
  await signOut(auth)
}

/** `fetch` with the signed-in user's Firebase ID token attached as a Bearer token. */
export async function authFetch(input: string, init: RequestInit = {}): Promise<Response> {
  await authReady()
  const token = auth.currentUser ? await auth.currentUser.getIdToken() : null
  const headers = new Headers(init.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  return fetch(input, { ...init, headers })
}
