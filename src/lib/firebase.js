import { initializeApp } from 'firebase/app'
import { getAnalytics } from 'firebase/analytics'

const firebaseConfig = {
  apiKey: 'AIzaSyDLs7Zh1RrkRlnmm1kcW_25ompDuT335gM',
  authDomain: 'elitestoremcbo.firebaseapp.com',
  projectId: 'elitestoremcbo',
  storageBucket: 'elitestoremcbo.firebasestorage.app',
  messagingSenderId: '4298206375',
  appId: '1:4298206375:web:626be57674714051bebf82',
  measurementId: 'G-5ME45QP8HH',
}

const app = initializeApp(firebaseConfig)
export const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null

export default app
