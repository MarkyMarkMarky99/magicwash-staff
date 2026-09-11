import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage'
import { storage } from '@/firebase'

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
