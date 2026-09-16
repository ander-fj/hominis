import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, writeBatch, query, limit } from 'firebase/firestore';
import { readFileSync } from 'fs';

const envContent = readFileSync('.env', 'utf-8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const key = parts[0].trim();
    const value = parts.slice(1).join('=').trim();
    envVars[key] = value;
  }
});

const firebaseConfig = {
  apiKey: envVars.VITE_FIREBASE_API_KEY,
  authDomain: envVars.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: envVars.VITE_FIREBASE_PROJECT_ID,
  storageBucket: envVars.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: envVars.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: envVars.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const collections = [
  'employees',
  'employee_scores',
  'attendance_records',
  'sst_trainings',
  'sst_ppe',
  'sst_medical_exams',
  'sst_incidents',
  'sst_goals',
  'employee_rankings',
  'evaluation_criteria',
  'sheets_sync_config',
  'employee_comments'
];

async function clearDatabase() {
  console.log('🗑️ Iniciando limpeza do banco de dados...\n');

  for (const colName of collections) {
    try {
      const colRef = collection(db, colName);
      let deletedCount = 0;
      
      while (true) {
        const snapshot = await getDocs(query(colRef, limit(400)));
        if (snapshot.empty) break;
        
        const batch = writeBatch(db);
        snapshot.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        
        deletedCount += snapshot.size;
        console.log(`  ...deletados ${deletedCount} registros de ${colName}`);
      }
      
      if (deletedCount > 0) {
        console.log(`✅ ${colName}: ${deletedCount} registros removidos.`);
      } else {
        console.log(`ℹ️ ${colName}: vazio.`);
      }
    } catch (error) {
      console.error(`❌ Erro ao limpar ${colName}:`, error.message);
    }
  }

  console.log('\n✨ Limpeza concluída!');
}

clearDatabase().catch(console.error);
