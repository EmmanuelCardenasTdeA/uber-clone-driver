// src/config/firebase.js
// AI-assisted: see docs/AI_LOG.md #2
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || 'AIzaSyAwFGlnWMU57WhOw81R_bkyUCwXRtbSbTU',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || 'uber-clone-drivers.firebaseapp.com',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'uber-clone-drivers',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || 'uber-clone-drivers.firebasestorage.app',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '1085996264106',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || '1:1085996264106:web:29daba0f726d3bee31fed3',
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);