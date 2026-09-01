import { getDownloadURL, ref as firebaseStorageRef, uploadBytes } from 'firebase/storage'
import { storage } from '@/firebase'

export async function uploadOrderImage(orderId: string, file: File): Promise<string> {
  const objectPath = `order-images/${orderId}/${Date.now()}_${file.name}`
  const objectRef = firebaseStorageRef(storage, objectPath)
  const snapshot = await uploadBytes(objectRef, file)
  return await getDownloadURL(snapshot.ref)
}
