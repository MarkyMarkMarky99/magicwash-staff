import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage'
import { storage } from '@/firebase'

/**
 * Metadata attached to every upload.
 *
 * The object name below is minted fresh on every write, so a stored object is never
 * overwritten and can be declared immutable. Without this, Firebase serves
 * `Cache-Control: private, max-age=0` and every repeat view of a photo pays a
 * revalidation round trip (~0.36s each, measured 2026-09-08) only to be told 304.
 *
 * `private` keeps customer photos out of shared proxies; the browser still caches.
 */
const IMMUTABLE_UPLOAD_METADATA = {
  cacheControl: 'private, max-age=31536000, immutable',
} as const

/**
 * Upload one file to Firebase Storage and return its download URL.
 *
 * The two photo systems write to different sheets but upload identically; `folder`
 * is the only thing that differs between them ('images' for the gallery,
 * `order-images/<orderId>` for order documentation).
 */
export async function uploadToStorage(file: File, folder = 'images'): Promise<string> {
  const objectRef = storageRef(storage, `${folder}/${Date.now()}_${file.name}`)
  const snapshot = await uploadBytes(objectRef, file, IMMUTABLE_UPLOAD_METADATA)
  return await getDownloadURL(snapshot.ref)
}
