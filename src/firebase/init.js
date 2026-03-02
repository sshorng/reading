import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'

const firebaseConfig = {
    apiKey: "AIzaSyB8uTu47VRp8WKnZ5QJ5IaVH1X2K2SJQwo",
    authDomain: "my-reading-platform.firebaseapp.com",
    projectId: "my-reading-platform",
    storageBucket: "my-reading-platform.firebasestorage.app",
    messagingSenderId: "200192012324",
    appId: "1:200192012324:web:fa181310ca103e269268b1"
}

export const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)
export const auth = getAuth(app)

// The original logic used a global variable. In Vue, we can just use a constant.
export const appId = 'default-reading-app-adventure-v2-full'
