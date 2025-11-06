import { supabase } from './supabase';

export async function seedSampleData() {
  const employees = [
    { name: 'Ana Oliveira', email: 'ana.oliveira@empresa.com', department: 'TI', position: 'Desenvolvedor', hire_date: '2020-09-05' },
    ];

  const { data: insertedEmployees, error: empError } = await supabase
    .from('employees')
    .upsert(employees, { onConflict: 'email' })
    .select();

  if (empError) {
    console.error('Erro ao inserir colaboradores:', empError);
    return;
  }

  if (!insertedEmployees || insertedEmployees.length === 0) return;

  const criteria = await supabase.from('evaluation_criteria').select('*');
  if (!criteria.data || criteria.data.length === 0) return;

  const currentMonth = '2025-10-01';
  const scores = [];

  for (const employee of insertedEmployees) {
    scores.push({
      employee_id: employee.id,
      criterion_id: criteria.data[0].id,
      period: currentMonth,
      raw_value: Math.floor(Math.random() * 5) + 1,
      normalized_score: 0,
    });

    scores.push({
      employee_id: employee.id,
      criterion_id: criteria.data[1].id,
      period: currentMonth,
      raw_value: Math.floor(Math.random() * 3),
      normalized_score: 0,
    });

    scores.push({
      employee_id: employee.id,
      criterion_id: criteria.data[2].id,
      period: currentMonth,
      raw_value: Math.floor(Math.random() * 20) + 160,
      normalized_score: 0,
    });

    scores.push({
      employee_id: employee.id,
      criterion_id: criteria.data[3].id,
      period: currentMonth,
      raw_value: Math.random() > 0.3 ? 1 : 0,
      normalized_score: 0,
    });

    scores.push({
      employee_id: employee.id,
      criterion_id: criteria.data[4].id,
      period: currentMonth,
      raw_value: Math.floor(Math.random() * 40) + 60,
      normalized_score: 0,
    });

    scores.push({
      employee_id: employee.id,
      criterion_id: criteria.data[5].id,
      period: currentMonth,
      raw_value: Math.floor(Math.random() * 30) + 70,
      normalized_score: 0,
    });
  }

  await supabase.from('employee_scores').upsert(scores, {
    onConflict: 'employee_id,criterion_id,period',
  });

  const today = new Date();
  const attendanceRecords = [];

  for (const employee of insertedEmployees) {
    for (let i = 0; i < 20; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      const rand = Math.random();
      let status: 'present' | 'absent' | 'late' | 'justified';
      let hours = 8;
      let delay = 0;

      if (rand < 0.85) {
        status = 'present';
        hours = 8 + (Math.random() - 0.5);
      } else if (rand < 0.92) {
        status = 'late';
        hours = 8;
        delay = Math.floor(Math.random() * 30) + 5;
      } else if (rand < 0.97) {
        status = 'justified';
        hours = 0;
      } else {
        status = 'absent';
        hours = 0;
      }

      attendanceRecords.push({
        employee_id: employee.id,
        date: dateStr,
        status,
        hours_worked: hours,
        delay_minutes: delay,
        justification: status === 'justified' ? 'Atestado médico' : '',
      });
    }
  }

  await supabase.from('attendance_records').upsert(attendanceRecords, {
    onConflict: 'employee_id,date',
    ignoreDuplicates: true,
  });

  for (const employee of insertedEmployees.slice(0, 5)) {
    await supabase.from('sst_trainings').insert([
      {
        employee_id: employee.id,
        training_name: 'NR-35 - Trabalho em Altura',
        training_type: 'Segurança',
        completion_date: '2024-06-15',
        expiry_date: '2026-06-15',
        status: 'valid',
      },
      {
        employee_id: employee.id,
        training_name: 'Primeiros Socorros',
        training_type: 'Saúde',
        completion_date: '2024-08-20',
        expiry_date: '2026-08-20',
        status: 'valid',
      },
    ]);

    await supabase.from('sst_ppe').insert([
      {
        employee_id: employee.id,
        ppe_type: 'Capacete',
        delivery_date: '2025-01-10',
        expiry_date: '2027-01-10',
        status: 'delivered',
      },
      {
        employee_id: employee.id,
        ppe_type: 'Luvas de Proteção',
        delivery_date: '2025-01-10',
        expiry_date: '2025-12-10',
        status: 'delivered',
      },
    ]);

    await supabase.from('sst_medical_exams').insert([
      {
        employee_id: employee.id,
        exam_type: 'Periódico',
        exam_date: '2025-03-15',
        next_exam_date: '2026-03-15',
        status: 'valid',
        result: 'Apto',
      },
    ]);
  }

  console.log('Dados de exemplo inseridos com sucesso!');
}
