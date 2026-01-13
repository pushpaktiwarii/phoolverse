import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// TODO: Replace with actual Firebase Config from Console
import { firebaseConfig } from './firebaseConfig';


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
