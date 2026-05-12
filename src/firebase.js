import { initializeApp } from 'firebase/app'
import { getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey:            'AIzaSyBxDx2bEZD-sww2uo_gzN93tx9dTRcBS-M',
  authDomain:        'magicwashlaundry-a50ca.firebaseapp.com',
  projectId:         'magicwashlaundry-a50ca',
  storageBucket:     'magicwashlaundry-a50ca.firebasestorage.app',
  messagingSenderId: '967978406004',
  appId:             '1:967978406004:web:d3552249e55dff9b0d8121',
}

const app = initializeApp(firebaseConfig)
export const storage = getStorage(app)
