import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// TODO: Replace with actual Firebase Config from Console
const firebaseConfig = {
  apiKey: "AIzaSyBd0ylFwj-t9EK15osfQb4oL44bIu0VLKw",
  authDomain: "foolverse.firebaseapp.com",
  projectId: "foolverse",
  storageBucket: "foolverse.firebasestorage.app",
  messagingSenderId: "446483566416",
  appId: "1:446483566416:web:bccfe897222d2ac739a655",
  measurementId: "G-R5PM1LLXJ9",
  databaseURL: "https://foolverse-default-rtdb.firebaseio.com"
};

// Flags to control Mock vs Real
export const USE_MOCK = false;

let app, db, rtdb, storage;

if (!USE_MOCK) {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  rtdb = getDatabase(app);
  storage = getStorage(app);
}

export { app, db, rtdb, storage };
