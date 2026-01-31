import { initializeApp, getApp, getApps } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCxRjTnbpcGColPD1YY30NlcDFKZb1ZJWk",
  authDomain: "hominis-84e9f.firebaseapp.com",
  projectId: "hominis-84e9f",
  storageBucket: "hominis-84e9f.firebasestorage.app",
  messagingSenderId: "825486447050",
  appId: "1:825486447050:web:3f8a103c655e1853267f33"
};

// Garante que o Firebase seja inicializado apenas uma vez (evita erros com HMR e React StrictMode)
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const db = getFirestore(app);

// Helper para desenvolvimento: Cria usuário admin padrão
if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as any).createAdmin = async () => {
    const email = "admin@hominis.com";
    const password = "admin123"; // Firebase exige min 6 caracteres
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      console.log(`✅ Usuário criado com sucesso!\nEmail: ${email}\nSenha: ${password}`);
    } catch (error: any) {
      if (error.code === 'auth/email-already-in-use') {
        await signInWithEmailAndPassword(auth, email, password);
        console.log(`✅ Login realizado com sucesso!\nUsuário: ${email}`);
      } else {
        console.error("Erro ao criar usuário:", error);
      }
    }
  };

  // Evita logs duplicados no modo de desenvolvimento com StrictMode
  if (!(window as any).adminHelperAttached) {
    console.log("Inicializando Firebase com projeto:", firebaseConfig.projectId);
    console.log("🔧 DEV MODE: Digite createAdmin() no console para acessar como admin.");
    (window as any).adminHelperAttached = true;
  }
}