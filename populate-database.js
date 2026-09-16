import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc } from 'firebase/firestore';
import { readFileSync } from 'fs';

const envContent = readFileSync('.env', 'utf-8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const [key, value] = line.split('=');
  if (key && value) {
    envVars[key.trim()] = value.trim();
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

const departments = ['TI', 'RH', 'Operações', 'Vendas', 'Logística', 'Manutenção'];
const positions = ['Analista', 'Coordenador', 'Gerente', 'Assistente', 'Supervisor', 'Técnico'];

const firstNames = ['Ana', 'João', 'Maria', 'Pedro', 'Juliana', 'Carlos', 'Fernanda', 'Ricardo', 'Camila', 'Lucas',
  'Patricia', 'Felipe', 'Amanda', 'Rafael', 'Beatriz', 'Rodrigo', 'Carolina', 'Bruno', 'Larissa', 'Diego',
  'Gabriela', 'Thiago', 'Mariana', 'André', 'Vanessa', 'Marcelo', 'Renata', 'Paulo', 'Aline', 'Gustavo'];

const lastNames = ['Silva', 'Santos', 'Oliveira', 'Souza', 'Pereira', 'Costa', 'Rodrigues', 'Almeida', 'Nascimento', 'Lima',
  'Araújo', 'Fernandes', 'Carvalho', 'Gomes', 'Martins', 'Rocha', 'Ribeiro', 'Alves', 'Monteiro', 'Mendes'];

function generateEmployees(count) {
  const employees = [];
  for (let i = 0; i < count; i++) {
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    const name = `${firstName} ${lastName}`;
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@empresa.com`;
    const department = departments[Math.floor(Math.random() * departments.length)];
    const position = positions[Math.floor(Math.random() * positions.length)];

    const yearAgo = Math.floor(Math.random() * 5) + 1;
    const hireDate = new Date();
    hireDate.setFullYear(hireDate.getFullYear() - yearAgo);

    employees.push({
      name,
      email,
      department,
      position,
      hire_date: hireDate.toISOString().split('T')[0],
      active: true
    });
  }
  return employees;
}

async function populateDatabase() {
  console.log('🚀 Iniciando população do banco de dados...\n');

  // 1. Inserir colaboradores
  console.log('📝 Inserindo 30 colaboradores...');
  const employees = generateEmployees(30);
  const insertedEmployees = [];
  
  for (const emp of employees) {
    try {
      const docRef = await addDoc(collection(db, 'employees'), emp);
      insertedEmployees.push({ id: docRef.id, ...emp });
    } catch (e) {
      console.error('❌ Erro ao inserir colaborador:', e);
    }
  }
  
  console.log(`✅ ${insertedEmployees.length} colaboradores inseridos\n`);

  // 2. Buscar critérios de avaliação
  // Nota: Em um cenário real, você buscaria do Firestore. Aqui vamos simular ou criar se não existirem.
  // Para simplificar este script de população, vou assumir critérios fixos ou criar novos.
  const criteria = [
    { id: 'crit_assiduidade', name: 'Assiduidade', data_type: 'percentage' },
    { id: 'crit_pontualidade', name: 'Pontualidade', data_type: 'numeric' },
    { id: 'crit_produtividade', name: 'Produtividade', data_type: 'score' }
  ];

  // 3. Inserir pontuações para os últimos 6 meses
  console.log('📊 Inserindo pontuações dos últimos 6 meses...');
  const scores = [];
  const months = [];

  for (let i = 0; i < 6; i++) {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    months.push(date.toISOString().slice(0, 7) + '-01');
  }

  for (const employee of insertedEmployees) {
    for (const month of months) {
      for (const criterion of criteria) {
        let rawValue;

        if (criterion.data_type === 'percentage') {
          rawValue = Math.floor(Math.random() * 30) + 70;
        } else if (criterion.data_type === 'numeric') {
          rawValue = Math.floor(Math.random() * 20) + 160;
        } else if (criterion.data_type === 'binary') {
          rawValue = Math.random() > 0.2 ? 1 : 0;
        } else {
          rawValue = Math.floor(Math.random() * 5) + 1;
        }

        scores.push({
          employee_id: employee.id,
          criterion_id: criterion.id,
          period: month,
          raw_value: rawValue,
          normalized_score: 0
        });
      }
    }
  }

  for (const score of scores) {
    await addDoc(collection(db, 'employee_scores'), score);
  }
  console.log(`✅ ${scores.length} pontuações inseridas\n`);

  // 4. Inserir registros de presença
  console.log('📅 Inserindo registros de presença...');
  const attendanceRecords = [];
  const today = new Date();

  for (const employee of insertedEmployees) {
    for (let i = 0; i < 30; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      const rand = Math.random();
      let status, hours, delay;

      if (rand < 0.85) {
        status = 'present';
        hours = 8 + (Math.random() - 0.5) * 0.5;
        delay = 0;
      } else if (rand < 0.92) {
        status = 'late';
        hours = 8;
        delay = Math.floor(Math.random() * 30) + 5;
      } else if (rand < 0.97) {
        status = 'justified';
        hours = 0;
        delay = 0;
      } else {
        status = 'absent';
        hours = 0;
        delay = 0;
      }

      attendanceRecords.push({
        employee_id: employee.id,
        date: dateStr,
        status,
        hours_worked: hours,
        delay_minutes: delay,
        justification: status === 'justified' ? 'Atestado médico' : ''
      });
    }
  }

  for (const record of attendanceRecords) {
    await addDoc(collection(db, 'attendance_records'), record);
  }
  console.log(`✅ ${attendanceRecords.length} registros de presença inseridos\n`);

  // 5. Inserir treinamentos SST
  console.log('🎓 Inserindo treinamentos...');
  const trainings = [];
  const trainingTypes = [
    { name: 'NR-35 - Trabalho em Altura', type: 'Segurança', duration: 24 },
    { name: 'NR-10 - Segurança em Instalações Elétricas', type: 'Segurança', duration: 24 },
    { name: 'Primeiros Socorros', type: 'Saúde', duration: 24 },
    { name: 'CIPA', type: 'Segurança', duration: 12 },
    { name: 'Combate a Incêndio', type: 'Segurança', duration: 12 }
  ];

  for (const employee of insertedEmployees) {
    const numTrainings = Math.floor(Math.random() * 3) + 1;
    for (let i = 0; i < numTrainings; i++) {
      const training = trainingTypes[Math.floor(Math.random() * trainingTypes.length)];
      const completionDate = new Date();
      completionDate.setMonth(completionDate.getMonth() - Math.floor(Math.random() * 12));

      const expiryDate = new Date(completionDate);
      expiryDate.setFullYear(expiryDate.getFullYear() + 2);

      trainings.push({
        employee_id: employee.id,
        training_name: training.name,
        training_type: training.type,
        completion_date: completionDate.toISOString().split('T')[0],
        expiry_date: expiryDate.toISOString().split('T')[0],
        status: expiryDate > new Date() ? 'valid' : 'expired'
      });
    }
  }

  for (const training of trainings) {
    await addDoc(collection(db, 'sst_trainings'), training);
  }
  console.log(`✅ ${trainings.length} treinamentos inseridos\n`);

  // 6. Inserir EPIs
  console.log('🦺 Inserindo EPIs...');
  const ppeItems = [];
  const ppeTypes = ['Capacete', 'Luvas de Proteção', 'Óculos de Proteção', 'Botinas', 'Protetor Auricular', 'Máscara'];

  for (const employee of insertedEmployees) {
    const numPPE = Math.floor(Math.random() * 4) + 2;
    for (let i = 0; i < numPPE; i++) {
      const ppeType = ppeTypes[Math.floor(Math.random() * ppeTypes.length)];
      const deliveryDate = new Date();
      deliveryDate.setMonth(deliveryDate.getMonth() - Math.floor(Math.random() * 6));

      const expiryDate = new Date(deliveryDate);
      expiryDate.setFullYear(expiryDate.getFullYear() + 1);

      ppeItems.push({
        employee_id: employee.id,
        ppe_type: ppeType,
        delivery_date: deliveryDate.toISOString().split('T')[0],
        expiry_date: expiryDate.toISOString().split('T')[0],
        status: 'delivered',
        ca_number: `CA-${Math.floor(Math.random() * 90000) + 10000}`,
        condition: Math.random() > 0.8 ? 'Usado' : 'Novo'
      });
    }
  }

  for (const ppe of ppeItems) {
    await addDoc(collection(db, 'sst_ppe'), ppe);
  }
  console.log(`✅ ${ppeItems.length} EPIs inseridos\n`);

  // 7. Inserir exames médicos
  console.log('🏥 Inserindo exames médicos...');
  const exams = [];
  const examTypes = ['Admissional', 'Periódico', 'Retorno ao Trabalho', 'Mudança de Função'];

  for (const employee of insertedEmployees) {
    const examType = examTypes[Math.floor(Math.random() * examTypes.length)];
    const examDate = new Date();
    examDate.setMonth(examDate.getMonth() - Math.floor(Math.random() * 8));

    const nextExamDate = new Date(examDate);
    nextExamDate.setFullYear(nextExamDate.getFullYear() + 1);

    exams.push({
      employee_id: employee.id,
      exam_type: examType,
      exam_date: examDate.toISOString().split('T')[0],
      next_exam_date: nextExamDate.toISOString().split('T')[0],
      status: nextExamDate > new Date() ? 'valid' : 'expired',
      result: Math.random() > 0.05 ? 'Apto' : 'Apto com Restrições'
    });
  }

  for (const exam of exams) {
    await addDoc(collection(db, 'sst_medical_exams'), exam);
  }
  console.log(`✅ ${exams.length} exames médicos inseridos\n`);

  console.log('✅ População do banco de dados concluída com sucesso!\n');
  console.log('📊 Resumo:');
  console.log(`   - ${insertedEmployees.length} colaboradores`);
  console.log(`   - ${scores.length} pontuações`);
  console.log(`   - ${attendanceRecords.length} registros de presença`);
  console.log(`   - ${trainings.length} treinamentos`);
  console.log(`   - ${ppeItems.length} EPIs`);
  console.log(`   - ${exams.length} exames médicos`);
}

populateDatabase().catch(console.error);
