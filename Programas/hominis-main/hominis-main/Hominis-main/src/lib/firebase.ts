import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Your web app's Firebase configuration.
// For security, consider moving this to environment variables.
const firebaseConfig = {
  apiKey: "AIzaSyCxRjTnbpcGColPD1YY30NlcDFKZb1ZJWk",
  authDomain: "hominis-84e9f.firebaseapp.com",
  projectId: "hominis-84e9f",
  storageBucket: "hominis-84e9f.appspot.com",
  messagingSenderId: "825486447050",
  appId: "1:825486447050:web:3f8a103c655e1853267f33"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize and export Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export { app };