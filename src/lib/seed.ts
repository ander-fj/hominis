import { db } from './firebase';
import { collection, getDocs, addDoc, writeBatch, doc, query, orderBy, terminate } from 'firebase/firestore';
import { clearRankingCache } from './rankingEngine';

export async function seedCriteriaIfEmpty(): Promise<boolean> {
  const criteriaCollection = collection(db, 'evaluation_criteria');
  const existingCriteriaSnapshot = await getDocs(query(criteriaCollection));
  if (existingCriteriaSnapshot.empty) {
    console.log('No evaluation criteria found. Seeding default criteria...');
    const defaultCriteria = [
      { name: 'Assiduidade', description: 'Presença do colaborador', data_type: 'percentage', weight: 25, direction: 'higher_better', source: 'calculated', display_order: 0, active: true, metric_type: 'percentage' },
      { name: 'Pontualidade', description: 'Cumprimento do horário', data_type: 'numeric', weight: 15, direction: 'lower_better', source: 'calculated', display_order: 1, active: true, metric_type: 'count' },
      { name: 'Horas Trabalhadas', description: 'Total de horas no período', data_type: 'numeric', weight: 20, direction: 'higher_better', source: 'calculated', display_order: 2, active: true, metric_type: 'hours' },
      { name: 'Treinamentos', description: 'Participação em treinamentos', data_type: 'numeric', weight: 10, direction: 'higher_better', source: 'manual', display_order: 3, active: true, metric_type: 'count' },
      { name: 'Colaboração', description: 'Avaliação de colaboração', data_type: 'score', weight: 15, direction: 'higher_better', source: 'manual', display_order: 4, active: true, metric_type: 'score' },
      { name: 'Metas Atingidas', description: 'Percentual de metas atingidas', data_type: 'percentage', weight: 15, direction: 'higher_better', source: 'manual', display_order: 5, active: true, metric_type: 'percentage' },
    ];
    const criteriaBatch = writeBatch(db);
    defaultCriteria.forEach(crit => {
      const docRef = doc(criteriaCollection);
      criteriaBatch.set(docRef, crit);
    });
    await criteriaBatch.commit();
    console.log('Default criteria seeded.');
    return true;
  }
  return false;
}

export async function seedSampleData() {
  // --- 0. Seed Criteria if they don't exist ---
  await seedCriteriaIfEmpty();
  const employeesToSeed = [
    { name: 'Ana Oliveira', email: 'ana.oliveira@empresa.com', department: 'TI', position: 'Desenvolvedor', hire_date: '2020-09-05', active: true },
    { name: 'Bruno Costa', email: 'bruno.costa@empresa.com', department: 'Operações', position: 'Operador', hire_date: '2021-11-20', active: true },
    { name: 'Carla Dias', email: 'carla.dias@empresa.com', department: 'RH', position: 'Analista', hire_date: '2019-07-10', active: true },
  ];

  const insertedEmployees: { id: string; [key: string]: any }[] = [];
  // Using individual adds to get back the IDs for linking.
  for (const empData of employeesToSeed) {
    // In a real scenario, you'd check for existing emails before adding.
    // For a simple seed, we'll just add them.
    const docRef = await addDoc(collection(db, 'employees'), empData);
    insertedEmployees.push({ id: docRef.id, ...empData });
  }
  console.log(`Seeded ${insertedEmployees.length} employees.`);

  if (insertedEmployees.length === 0) {
    console.error('No employees were seeded, aborting rest of seed.');
    return;
  }

  // --- 2. Get Criteria ---
  const criteriaSnapshot = await getDocs(query(collection(db, 'evaluation_criteria'), orderBy('display_order')));
  if (criteriaSnapshot.empty) {
    console.error('No evaluation criteria found. Please seed criteria first.');
    return;
  }
  const criteria = criteriaSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  // Create a map for easy lookup by name
  const criteriaMap = new Map(criteria.map(c => [c.name, c.id]));

  // --- Start Batch for remaining data ---
  const batch = writeBatch(db);
  const today = new Date();

  // --- 3. Seed Scores (Histórico de 6 meses para tendências) ---
  for (let i = 0; i < 6; i++) {
    const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const period = date.toISOString().split('T')[0];

    for (const employee of insertedEmployees) {
      if (criteriaMap.has('Assiduidade')) {
        const scoreData = {
          employee_id: employee.id,
          criterion_id: criteriaMap.get('Assiduidade'),
          period: period,
          raw_value: Math.floor(Math.random() * 10) + 90, // 90-100%
          normalized_score: 0,
        };
        batch.set(doc(collection(db, 'employee_scores')), scoreData);
      }
      if (criteriaMap.has('Pontualidade')) {
          const scoreData = {
            employee_id: employee.id,
            criterion_id: criteriaMap.get('Pontualidade'),
            period: period,
            raw_value: Math.floor(Math.random() * 3), // 0-2 atrasos
            normalized_score: 0,
          };
          batch.set(doc(collection(db, 'employee_scores')), scoreData);
      }
      if (criteriaMap.has('Horas Trabalhadas')) {
          const scoreData = {
            employee_id: employee.id,
            criterion_id: criteriaMap.get('Horas Trabalhadas'),
            period: period,
            raw_value: Math.floor(Math.random() * 20) + 160, // 160-180 horas
            normalized_score: 0,
          };
          batch.set(doc(collection(db, 'employee_scores')), scoreData);
      }
    }
  }

  // --- 4. Seed Attendance Records ---
  for (const employee of insertedEmployees) {
    for (let i = 0; i < 60; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      const rand = Math.random();
      let status: 'present' | 'absent' | 'late' | 'justified' = 'present';
      let hours = 8;
      let delay = 0;

      if (rand < 0.85) {
        status = 'present';
        hours = 8 + (Math.random() - 0.5);
      } else if (rand < 0.92) {
        status = 'late';
        delay = Math.floor(Math.random() * 30) + 5;
      } else if (rand < 0.97) {
        status = 'justified';
        hours = 0;
      } else {
        status = 'absent';
        hours = 0;
      }

      const attendanceData = {
        employee_id: employee.id,
        date: dateStr,
        status,
        hours_worked: hours,
        delay_minutes: delay,
        justification: status === 'justified' ? 'Atestado médico' : '',
      };
      batch.set(doc(collection(db, 'attendance_records')), attendanceData);
    }
  }

  // --- 5. Seed SST Data ---
  for (const employee of insertedEmployees) {
    batch.set(doc(collection(db, 'sst_trainings')), {
        employee_id: employee.id,
        training_name: 'NR-35 - Trabalho em Altura',
        training_type: 'Segurança',
        completion_date: '2024-06-15',
        expiry_date: '2026-06-15',
        status: 'valid',
    });

    batch.set(doc(collection(db, 'sst_ppe')), {
        employee_id: employee.id,
        ppe_type: 'Capacete',
        delivery_date: '2025-01-10',
        expiry_date: '2027-01-10',
        status: 'delivered',
    });

    batch.set(doc(collection(db, 'sst_medical_exams')), {
        employee_id: employee.id,
        exam_type: 'Periódico',
        exam_date: '2025-03-15',
        next_exam_date: '2026-03-15',
        status: 'valid',
        result: 'Apto',
    });
  }

  // --- Commit all writes ---
  await batch.commit();
  console.log('Dados de exemplo inseridos com sucesso!');
}

export async function clearAllSystemData(): Promise<void> {
  console.log('Iniciando limpeza completa do sistema...');

  try {
    const collections = [
      'employees',
      'employee_scores',
      'employee_rankings',
      'attendance_records',
      'sst_trainings',
      'sst_ppe',
      'sst_medical_exams',
      'sst_incidents',
      'sst_goals',
      'employee_comments',
      'sheets_sync_config',
      'evaluation_criteria',
      'sheets_sync_pages',
      'ranking_recalculation_queue',
      'vacation_records'
    ];

    for (const colName of collections) {
      const q = query(collection(db, colName));
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        const batchSize = 400;
        const chunks = [];
        for (let i = 0; i < snapshot.docs.length; i += batchSize) {
          chunks.push(snapshot.docs.slice(i, i + batchSize));
        }

        for (const chunk of chunks) {
          const batch = writeBatch(db);
          chunk.forEach(doc => batch.delete(doc.ref));
          await batch.commit();
        }
      }
    }
  } catch (error) {
    console.error('Erro ao limpar dados do Firestore:', error);
  } finally {
    // Encerra a conexão com o Firestore para liberar o bloqueio do IndexedDB e garantir limpeza
    try { await terminate(db); } catch (e) { console.warn('Erro ao encerrar Firestore:', e); }

    if (typeof window !== 'undefined') {
      try {
        // Limpeza agressiva do LocalStorage e SessionStorage
        localStorage.clear();
        sessionStorage.clear();
        
        // Força limpeza de cookies também, caso haja algo persistido lá
        document.cookie.split(";").forEach((c) => {
          document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
        });

        // Limpeza do Cache Storage (Service Workers, etc)
        if ('caches' in window) {
          try {
            const keys = await window.caches.keys();
            await Promise.all(keys.map(key => window.caches.delete(key)));
            console.log('Cache Storage limpo.');
          } catch (e) { console.warn('Erro ao limpar Cache Storage:', e); }
        }

        // Limpeza do IndexedDB (Essencial para remover cache persistente do Firebase)
        const win = window as any;
        if (win.indexedDB && typeof win.indexedDB.databases === 'function') {
          try {
            const dbs = await win.indexedDB.databases();
            if (dbs) {
              for (const dbInfo of dbs) {
                if (dbInfo.name) {
                  await new Promise<void>((resolve) => {
                    const req = win.indexedDB.deleteDatabase(dbInfo.name);
                    req.onsuccess = () => resolve();
                    req.onerror = () => resolve();
                    req.onblocked = () => resolve();
                  });
                  console.log(`Banco de dados local deletado: ${dbInfo.name}`);
                }
              }
            }
          } catch (e) { console.warn('Erro ao limpar IndexedDB:', e); }
        }
        console.log('Storage local, cookies e IndexedDB limpos com sucesso.');
      } catch (e) {
        console.error('Erro ao limpar dados locais:', e);
        // Fallback de emergência
        try { localStorage.clear(); } catch (e) {}
      }
    }
    clearRankingCache();
    console.log('Todos os dados do sistema (Firestore e Local) foram excluídos.');
    if (typeof window !== 'undefined') {
      // Delay aumentado para 1000ms para garantir que o IndexedDB seja limpo antes do reload
      setTimeout(() => {
        localStorage.clear(); // Última garantia antes do reload
        window.location.reload();
      }, 1000);
    }
  }
}
