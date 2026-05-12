import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { storage } from '../firebase'
import { compressImage } from '../utils/imageCompression'

export async function uploadRaw(file, folder = 'images') {
  const filename = `${Date.now()}_${file.name}`
  const storageRef = ref(storage, `${folder}/${filename}`)
  const snapshot = await uploadBytes(storageRef, file)
  return getDownloadURL(snapshot.ref)
}

export async function uploadImage(file, folder = 'images') {
  file = await compressImage(file)
  return uploadRaw(file, folder)
}

export async function uploadImages(files, folder = 'images') {
  return Promise.all(files.map((file) => uploadImage(file, folder)))
}
