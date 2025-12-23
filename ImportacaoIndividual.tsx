import { useState, useRef } from 'react';
import { Upload, FileSpreadsheet, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { db } from '@/lib/firebase';
import MRSCard from './MRSCard';
import { calculateIntelligentRanking } from '@/lib/rankingEngine';
import { collection, getDocs, query, where, doc, updateDoc, addDoc, getCountFromServer, limit, writeBatch } from 'firebase/firestore';
import { useAuth } from '@/App';

type ImportType = 'colaboradores' | 'avaliacoes' | 'treinamentos' | 'epis' | 'exames' | 'incidentes' | 'ferias';

interface ImportStatus {
  type: ImportType;
  status: 'idle' | 'processing' | 'success' | 'error';
  message: string;
  count?: number;
}

const IMPORT_CONFIGS = {
  colaboradores: {
    title: 'Colaboradores',
    description: 'Cadastro de funcionários',
    sheetName: 'Colaboradores',
    icon: '👥',
    columns: ['email', 'nome', 'departamento', 'cargo', 'data_admissao', 'foto_url']
  },
  avaliacoes: {
    title: 'Avaliações',
    description: 'Avaliações de desempenho',
    sheetName: 'Avaliacoes',
    icon: '📊',
    columns: ['employee_id', 'periodo', 'horas_trabalhadas', 'faltas_injustificadas', 'atrasos']
  },
  treinamentos: {
    title: 'Treinamentos',
    description: 'Registros de capacitação',
    sheetName: 'Treinamentos',
    icon: '🎓',
    columns: ['employee_id', 'training_name', 'training_date', 'expiry_date', 'status']
  },
  epis: {
    title: 'EPIs',
    description: 'Equipamentos de proteção',
    sheetName: 'EPIs',
    icon: '🦺',
    columns: ['employee_id', 'equipment_type', 'delivery_date', 'expiry_date', 'ca_number', 'condition']
  },
  exames: {
    title: 'Exames Médicos',
    description: 'Exames ocupacionais',
    sheetName: 'Exames',
    icon: '🏥',
    columns: ['employee_id', 'exam_type', 'exam_date', 'next_exam_date', 'result']
  },
  incidentes: {
    title: 'Incidentes',
    description: 'Acidentes e quase-acidentes',
    sheetName: 'Incidentes',
    icon: '⚠️',
    columns: ['employee_id', 'incident_date', 'incident_type', 'severity (leve/moderado/grave/fatal)', 'description']
  },
  ferias: {
    title: 'Férias',
    description: 'Períodos de férias',
    sheetName: 'Ferias',
    icon: '🏖️',
    columns: ['employee_id', 'period_start', 'period_end', 'days_taken', 'status', 'notes']
  }
};

const deleteSampleEmployees = async (companyId: string | null) => {
  if (!companyId) return 0;

  console.log(`Verificando e deletando colaboradores de exemplo para a empresa: ${companyId}`);

  try {
      const employeesRef = collection(db, 'employees');
      const q = query(employeesRef, where('companyId', '==', companyId));
      const querySnapshot = await getDocs(q);

      const sampleDocsToDelete = querySnapshot.docs.filter(doc => {
          const email = doc.data().email as string | undefined;
          // Assumindo que e-mails de exemplo terminam com @empresa.com com base nos templates
          return email && email.endsWith('@empresa.com');
      });

      if (sampleDocsToDelete.length > 0) {
          const batch = writeBatch(db);
          sampleDocsToDelete.forEach(doc => {
              console.log(`Agendando para deletar colaborador de exemplo: ${doc.data().name} (${doc.id})`);
              batch.delete(doc.ref);
          });
          await batch.commit();
          console.log(`${sampleDocsToDelete.length} colaborador(es) de exemplo foram deletados.`);
          return sampleDocsToDelete.length;
      } else {
          console.log('Nenhum colaborador de exemplo encontrado para deletar.');
          return 0;
      }
  } catch (error) {
      console.error('Erro ao deletar colaboradores de exemplo:', error);
      return 0;
  }
};

export default function ImportacaoIndividual() {
  const { companyId } = useAuth();
  const [statuses, setStatuses] = useState<Record<ImportType, ImportStatus>>({
    colaboradores: { type: 'colaboradores', status: 'idle', message: '' },
    avaliacoes: { type: 'avaliacoes', status: 'idle', message: '' },
    treinamentos: { type: 'treinamentos', status: 'idle', message: '' },
    epis: { type: 'epis', status: 'idle', message: '' },
    exames: { type: 'exames', status: 'idle', message: '' },
    incidentes: { type: 'incidentes', status: 'idle', message: '' },
    ferias: { type: 'ferias', status: 'idle', message: '' }
  });

  const fileRefs = useRef<Record<ImportType, HTMLInputElement | null>>({
    colaboradores: null,
    avaliacoes: null,
    treinamentos: null,
    epis: null,
    exames: null,
    incidentes: null,
    ferias: null
  });

  const parseExcelDate = (value: any): string | null => {
    if (!value) return null;

    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
      return value.split('T')[0];
    }

    if (typeof value === 'number') {
      const date = new Date((value - 25569) * 86400 * 1000);
      return date.toISOString().split('T')[0];
    }

    if (typeof value === 'string') {
      const parts = value.split('/');
      if (parts.length === 3) {
        const day = parts[0].padStart(2, '0');
        const month = parts[1].padStart(2, '0');
        let year = parts[2];

        if (year.length === 2) {
          const currentYear = new Date().getFullYear();
          const century = Math.floor(currentYear / 100) * 100;
          year = String(century + parseInt(year));
        }

        return `${year}-${month}-${day}`;
      }
    }

    return null;
  };

  const updateStatus = (type: ImportType, status: 'idle' | 'processing' | 'success' | 'error', message: string, count?: number) => {
    setStatuses(prev => ({
      ...prev,
      [type]: { type, status, message, count }
    }));
  };

  const handleImport = async (type: ImportType, file: File) => {
    updateStatus(type, 'processing', 'Processando arquivo...', 0);
    console.log(`[${type}] Iniciando importação para companyId: ${companyId}`);

    try {
      // Verify employees exist for non-employee imports
      if (type !== 'colaboradores') {
        console.log(`[${type}] Verificando se existem colaboradores...`);
        if (!companyId) throw new Error("ID da empresa não encontrado. Faça login novamente.");
        const employeesCol = collection(db, 'employees');
        const q = query(employeesCol, where('companyId', '==', companyId));
        const snapshot = await getCountFromServer(q);
        const count = snapshot.data().count;
        
        console.log(`[${type}] Resultado da verificação:`, {
          count,
        });

        const employees = count > 0 ? [{id: 'exists'}] : [];

        if (!employees || employees.length === 0) {
          console.error(`[${type}] Nenhum colaborador encontrado na base de dados`);
          updateStatus(type, 'error', 'Colaboradores não encontrados. Importe primeiro a planilha de Colaboradores.', 0);
          return;
        }

        console.log(`[${type}] Verificação OK - ${count || employees.length} colaboradores encontrados`);
      }

      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const config = IMPORT_CONFIGS[type];

      if (!workbook.SheetNames.includes(config.sheetName)) {
        updateStatus(type, 'error', `Aba "${config.sheetName}" não encontrada`, 0);
        return;
      }

      const sheet = workbook.Sheets[config.sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet) as any[];

      if (rows.length === 0) {
        updateStatus(type, 'error', 'Nenhum dado encontrado', 0);
        return;
      }

      let successCount = 0;
      let errorCount = 0;

      switch (type) {
        case 'colaboradores':
          for (const row of rows) {
            try {
              const employeeData = {
                  name: (row.nome || row.name || '').trim(),
                  email: (row.email || '').trim(),
                  department: row.departamento || row.department,
                  position: row.cargo || row.position,
                  companyId: companyId,
                  hire_date: parseExcelDate(row.data_admissao || row.hire_date),
                  photo_url: row.foto_url || row.photo_url || null
              };

              const q = query(collection(db, 'employees'), where('email', '==', employeeData.email));
              const existing = await getDocs(q);
              if (existing.empty) {
                await addDoc(collection(db, 'employees'), employeeData);
              } else {
                await updateDoc(doc(db, 'employees', existing.docs[0].id), employeeData);
              }
              successCount++;
            } catch (e) {
              errorCount++;
            }
          }
          break;

        case 'avaliacoes':
          console.log(`Iniciando importação de ${rows.length} avaliações...`);

          const criteriaCol = collection(db, 'evaluation_criteria');
          let criteriaQuery = query(criteriaCol, where('companyId', '==', companyId));
          let criteriaSnapshot = await getDocs(criteriaQuery);

          if (criteriaSnapshot.empty) {
            console.log("[avaliacoes] Nenhum critério encontrado, criando critérios padrão...");
            const defaultCriteria = [
              { name: 'Assiduidade', description: 'Presença no trabalho', weight: 30, direction: 'higher_better', data_type: 'percentage', source: 'manual', display_order: 0, active: true, companyId },
              { name: 'Pontualidade', description: 'Chegadas no horário', weight: 20, direction: 'lower_better', data_type: 'numeric', source: 'manual', display_order: 1, active: true, companyId },
              { name: 'Horas Trabalhadas', description: 'Horas trabalhadas no período', weight: 10, direction: 'higher_better', data_type: 'numeric', source: 'manual', display_order: 2, active: true, companyId },
              { name: 'Qualidade do Trabalho', description: 'Qualidade geral das entregas', weight: 25, direction: 'higher_better', data_type: 'score', source: 'manual', display_order: 3, active: true, companyId },
              { name: 'Trabalho em Equipe', description: 'Colaboração com colegas', weight: 15, direction: 'higher_better', data_type: 'score', source: 'manual', display_order: 4, active: true, companyId },
            ];
            const batch = writeBatch(db);
            defaultCriteria.forEach(criterion => {
              const newDocRef = doc(criteriaCol);
              batch.set(newDocRef, criterion);
            });
            await batch.commit();
            console.log("[avaliacoes] Critérios padrão criados.");
            // Recarregar critérios após a criação
            criteriaSnapshot = await getDocs(criteriaQuery);
          }

          const criteria = criteriaSnapshot.docs.map(d => ({id: d.id, ...d.data()}));

          if (criteria.length === 0) {
            updateStatus(type, 'error', 'ERRO: Falha ao carregar ou criar critérios de avaliação. Tente novamente ou contate o suporte.', 0);
            return;
          }

          // Otimização: Carregar todos os colaboradores em memória para evitar N+1 queries
          const employeesQuery = query(collection(db, 'employees'), where('companyId', '==', companyId));
          const employeesSnapshot = await getDocs(employeesQuery);
          const employeesMap = new Map<string, any>();
          employeesSnapshot.docs.forEach(doc => {
            const data = doc.data();
            if (data.email) employeesMap.set(data.email.trim().toLowerCase(), { id: doc.id, ...data });
          });
          console.log(`[avaliacoes] Cache de colaboradores criado: ${employeesMap.size} registros`);

          const horasCriteria = criteria.find(c => c.name === 'Horas Trabalhadas');
          const faltasCriteria = criteria.find(c => c.name === 'Assiduidade');
          const atrasosCriteria = criteria.find(c => c.name === 'Pontualidade');

          for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            if ((i + 1) % 10 === 0) console.log(`Processando linha ${i + 1}/${rows.length}...`);

            try {
              const email = row.employee_id ? String(row.employee_id).trim().toLowerCase() : '';
              const employee = employeesMap.get(email);
              
              if (!employee) {
                console.error('Colaborador não encontrado:', row.employee_id);
                errorCount++;
                continue;
              }

              let periodo = row.periodo || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`;

              if (periodo && typeof periodo === 'string') {
                const trimmed = periodo.trim();
                if (trimmed.match(/^\d{4}-\d{1,2}$/)) {
                  const [year, month] = trimmed.split('-');
                  periodo = `${year}-${month.padStart(2, '0')}-01`;
                } else if (!trimmed.match(/^\d{4}-\d{2}-\d{2}$/)) {
                  console.error('Formato de período inválido:', periodo);
                  errorCount++;
                  continue;
                }
              }

              const scores = [];

              if (horasCriteria && row.horas_trabalhadas !== undefined && row.horas_trabalhadas !== null) {
                const horas = parseFloat(String(row.horas_trabalhadas));
                scores.push({
                  employee_id: employee.id,
                  companyId: companyId,
                  period: periodo,
                  criterion_id: horasCriteria.id,
                  raw_value: horas,
                  normalized_score: horas / 220
                });
              }

              if (faltasCriteria && row.faltas_injustificadas !== undefined && row.faltas_injustificadas !== null) {
                const faltas = parseFloat(String(row.faltas_injustificadas));
                const assiduidade = Math.max(0, 100 - (faltas * 5));
                scores.push({
                  employee_id: employee.id,
                  companyId: companyId,
                  period: periodo,
                  criterion_id: faltasCriteria.id,
                  raw_value: assiduidade,
                  normalized_score: assiduidade / 100
                });
              }

              if (atrasosCriteria && row.atrasos !== undefined && row.atrasos !== null) {
                const atrasos = parseFloat(String(row.atrasos));
                scores.push({
                  employee_id: employee.id,
                  companyId: companyId,
                  period: periodo,
                  criterion_id: atrasosCriteria.id,
                  raw_value: atrasos,
                  normalized_score: Math.max(0, 1 - (atrasos / 10))
                });
              }

              if (scores.length === 0) {
                errorCount++;
                continue;
              }

              for (const score of scores) {
                // Firestore upsert logic
                const scoreQuery = query(collection(db, 'employee_scores'), 
                  where('employee_id', '==', score.employee_id),
                  where('period', '==', score.period),
                  where('criterion_id', '==', score.criterion_id)
                );
                const existingScore = await getDocs(scoreQuery);
                let scoreError = null;
                if (existingScore.empty) {
                  await addDoc(collection(db, 'employee_scores'), score).catch(e => scoreError = e);
                } else {
                  await updateDoc(doc(db, 'employee_scores', existingScore.docs[0].id), score).catch(e => scoreError = e);
                }
                if (scoreError) {
                  console.error('Erro ao inserir score:', scoreError);
                  errorCount++;
                } else {
                  successCount++;
                }
              }
            } catch (err) {
              console.error('Erro ao processar linha:', err);
              errorCount++;
            }
          }
          break;

        case 'treinamentos':
          for (const row of rows) {
            const email = row.employee_id ? String(row.employee_id).trim() : (row.email ? String(row.email).trim() : '');
            const q = query(collection(db, 'employees'), where('companyId', '==', companyId), where('email', '==', email));
            const snapshot = await getDocs(q);
            const employee = snapshot.empty ? null : { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
            
            if (!employee) {
              errorCount++;
              continue;
            }

            try {
              await addDoc(collection(db, 'sst_trainings'), {
                employee_id: employee.id,
                companyId: companyId,
                training_name: row.training_name,
                training_type: row.training_type || 'Segurança',
                completion_date: parseExcelDate(row.training_date),
                expiry_date: parseExcelDate(row.expiry_date),
                status: row.status === 'Concluído' ? 'valid' : 'pending'
              });
              successCount++;
            } catch (e) {
              errorCount++;
            }
          }
          break;

        case 'epis':
          for (const row of rows) {
            const email = row.employee_id ? String(row.employee_id).trim() : (row.email ? String(row.email).trim() : '');
            const q = query(collection(db, 'employees'), where('companyId', '==', companyId), where('email', '==', email));
            const snapshot = await getDocs(q);
            const employee = snapshot.empty ? null : { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
            
            if (!employee) {
              errorCount++;
              continue;
            }

            try {
              await addDoc(collection(db, 'sst_ppe'), {
                employee_id: employee.id,
                companyId: companyId,
                ppe_type: row.equipment_type,
                delivery_date: parseExcelDate(row.delivery_date),
                expiry_date: parseExcelDate(row.expiry_date),
                status: 'delivered',
                ca_number: row.ca_number,
                condition: row.condition || 'Novo'
              });
              successCount++;
            } catch(e) {
              errorCount++;
            }
          }
          break;

        case 'exames':
          for (const row of rows) {
            const email = row.employee_id ? String(row.employee_id).trim() : (row.email ? String(row.email).trim() : '');
            const q = query(collection(db, 'employees'), where('companyId', '==', companyId), where('email', '==', email));
            const snapshot = await getDocs(q);
            const employee = snapshot.empty ? null : { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
            
            if (!employee) {
              errorCount++;
              continue;
            }

            try {
              await addDoc(collection(db, 'sst_medical_exams'), {
                employee_id: employee.id,
                companyId: companyId,
                exam_type: row.exam_type || 'Admissional',
                exam_date: parseExcelDate(row.exam_date),
                next_exam_date: parseExcelDate(row.next_exam_date),
                status: 'valid',
                result: row.result || 'Apto'
              });
              successCount++;
            } catch (e) {
              errorCount++;
            }
          }
          break;

        case 'incidentes':
          for (const row of rows) {
            console.log('[incidentes] Processando linha:', row);
            console.log('[incidentes] Keys disponíveis:', Object.keys(row));

            const email = row.employee_id ? String(row.employee_id).trim() : (row.email ? String(row.email).trim() : '');
            const q = query(collection(db, 'employees'), where('companyId', '==', companyId), where('email', '==', email));
            const snapshot = await getDocs(q);
            const employee = snapshot.empty ? null : { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
            
            console.log('[incidentes] Colaborador encontrado:', employee);

            if (!employee || !employee.department) {
              console.error('Colaborador não encontrado ou sem departamento:', row.employee_id);
              errorCount++;
              continue;
            }

            const severityKey = Object.keys(row).find(key =>
              key.toLowerCase().includes('severity') ||
              key.toLowerCase().includes('gravidade')
            );
            const severity = severityKey ? row[severityKey] : row.severity;

            console.log('[incidentes] Severity key:', severityKey, 'Valor:', severity);

            if (!severity) {
              console.error('Severity não encontrado na linha');
              errorCount++;
              continue;
            }

            const incidentData = {
              employee_id: employee.id,
              companyId: companyId,
              incident_date: parseExcelDate(row.incident_date),
              incident_type: row.incident_type,
              severity: severity.toLowerCase(),
              description: row.description || '',
              department: employee.department,
              days_lost: row.days_lost || 0
            };

            console.log('[incidentes] Dados a serem inseridos:', incidentData);

            try {
              await addDoc(collection(db, 'sst_incidents'), incidentData);
              successCount++;
            } catch (error) {
              console.error('Erro ao inserir incidente:', error);
              errorCount++;
            }
          }
          break;

        case 'ferias':
          for (const row of rows) {
            console.log('[ferias] Processando linha:', row);
            const email = row.employee_id ? String(row.employee_id).trim() : (row.email ? String(row.email).trim() : '');
            const q = query(collection(db, 'employees'), where('companyId', '==', companyId), where('email', '==', email));
            const snapshot = await getDocs(q);
            const employee = snapshot.empty ? null : { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
            
            if (!employee) {
              console.error('[ferias] Colaborador não encontrado:', row.employee_id);
              errorCount++;
              continue;
            }

            const vacationData = {
              employee_id: employee.id,
              companyId: companyId,
              period_start: parseExcelDate(row.period_start),
              period_end: parseExcelDate(row.period_end),
              days_taken: row.days_taken || 0,
              status: row.status || 'Planejado',
              notes: row.notes || ''
            };

            console.log('[ferias] Dados a serem inseridos:', vacationData);

            try {
              await addDoc(collection(db, 'vacation_records'), vacationData);
              successCount++;
            } catch(e) {
              console.error('[ferias] Erro ao inserir registro de férias:', e);
              errorCount++;
            }
          }
          break;
      }

      if (successCount > 0) {
        let finalMessage = errorCount > 0
            ? `${successCount} importados, ${errorCount} erros`
            : `${successCount} registros importados com sucesso!`;

        // Deleta dados de exemplo se a importação de colaboradores for bem sucedida
        if (type === 'colaboradores' && errorCount === 0) {
            const deletedCount = await deleteSampleEmployees(companyId);
            if (deletedCount > 0) {
                finalMessage += `\n${deletedCount} colaborador(es) de exemplo foram removidos.`;
            }
        }

        updateStatus(
          type,
          errorCount > 0 ? 'error' : 'success',
          finalMessage,
          successCount
        );

        if (type === 'avaliacoes') {
          try {
            const uniquePeriods = new Set<string>();
            for (const row of rows) {
              let periodo = row.periodo || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`;
              if (periodo && typeof periodo === 'string') {
                const trimmed = periodo.trim();
                if (trimmed.match(/^\d{4}-\d{1,2}$/)) {
                  const [year, month] = trimmed.split('-');
                  periodo = `${year}-${month.padStart(2, '0')}-01`;
                }
                uniquePeriods.add(periodo);
              }
            }

            for (const period of uniquePeriods) {
              await calculateIntelligentRanking(period, false, companyId);
            }
            console.log('Rankings recalculados automaticamente');
          } catch (err) {
            console.error('Erro ao recalcular rankings:', err);
          }
        }
      } else {
        const errorMsg = type !== 'colaboradores' && errorCount > 0
          ? 'Nenhum registro importado. Verifique se os e-mails/IDs dos colaboradores na planilha correspondem aos cadastrados no sistema.'
          : `${errorCount > 0 ? errorCount : 'Nenhum'} erro(s) encontrado(s). Verifique o formato dos dados ou se o arquivo está vazio.`;
        updateStatus(type, 'error', errorMsg, 0);
      }

    } catch (error: any) {
      updateStatus(type, 'error', error.message || 'Erro ao processar arquivo', 0);
    }
  };

  const handleFileChange = (type: ImportType, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleImport(type, file);
    }
    event.target.value = '';
  };

  const getStatusIcon = (status: ImportStatus['status']) => {
    switch (status) {
      case 'processing':
        return <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#002b55]" />;
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-600" />;
      default:
        return <AlertCircle className="w-5 h-5 text-gray-400" />;
    }
  };

  const downloadTemplate = (type: ImportType) => {
    const config = IMPORT_CONFIGS[type];
    const workbook = XLSX.utils.book_new();

    let sampleData: any[][] = [config.columns];

    switch (type) {
      case 'colaboradores':
        sampleData.push(['joao.silva@empresa.com', 'João Silva', 'Operações', 'Operador', '15/01/2020', '']);
        sampleData.push(['maria.santos@empresa.com', 'Maria Santos', 'Produção', 'Técnica', '20/03/2019', '']);
        break;
      case 'avaliacoes':
        sampleData.push(['joao.silva@empresa.com', '2025-01', 220, 0, 2]);
        sampleData.push(['maria.santos@empresa.com', '2025-01', 200, 1, 0]);
        sampleData.push(['joao.silva@empresa.com', '2025-02', 210, 0, 1]);
        break;
      case 'treinamentos':
        sampleData.push(['joao.silva@empresa.com', 'NR-35 Trabalho em Altura', '10/10/2025', '10/10/2027', 'Concluído']);
        break;
      case 'epis':
        sampleData.push(['joao.silva@empresa.com', 'Capacete', '01/10/2025', '01/10/2027', '12345', 'Novo']);
        break;
      case 'exames':
        sampleData.push(['joao.silva@empresa.com', 'Periódico', '05/10/2025', '05/10/2026', 'Apto']);
        break;
      case 'incidentes':
        sampleData.push(['joao.silva@empresa.com', '12/10/2025', 'Quase-acidente', 'leve', 'Escorregão']);
        sampleData.push(['maria.santos@empresa.com', '15/10/2025', 'Acidente', 'moderado', 'Corte na mão']);
        break;
      case 'ferias':
        sampleData.push(['joao.silva@empresa.com', '01/12/2025', '15/12/2025', '15', 'Aprovado']);
        break;
    }

    const worksheet = XLSX.utils.aoa_to_sheet(sampleData);
    XLSX.utils.book_append_sheet(workbook, worksheet, config.sheetName);
    XLSX.writeFile(workbook, `Template_${config.title}.xlsx`);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[#002b55]">Importação Individual de Planilhas</h1>

      <MRSCard title="Como funciona" subtitle="Importe dados de forma independente por categoria">
        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-lg">
          <p className="text-sm text-gray-700">
            <strong>Novo sistema de importação:</strong> Agora você pode carregar cada tipo de dado separadamente.
            Baixe o template específico, preencha com seus dados e importe. Simples e organizado!
          </p>
        </div>
      </MRSCard>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {(Object.keys(IMPORT_CONFIGS) as ImportType[]).map((type) => {
          const config = IMPORT_CONFIGS[type];
          const status = statuses[type];

          return (
            <MRSCard key={type} title={`${config.icon} ${config.title}`} subtitle={config.description}>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm font-medium text-gray-700">Status</span>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(status.status)}
                    {status.count !== undefined && status.count > 0 && (
                      <span className="text-sm font-semibold text-green-600">
                        {status.count}
                      </span>
                    )}
                  </div>
                </div>

                {status.message && (
                  <div className={`p-3 rounded-lg text-sm ${
                    status.status === 'success' ? 'bg-green-50 text-green-700' :
                    status.status === 'error' ? 'bg-red-50 text-red-700' :
                    'bg-blue-50 text-blue-700'
                  }`}>
                    {status.message}
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => downloadTemplate(type)}
                    className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    Template
                  </button>
                  <button
                    onClick={() => fileRefs.current[type]?.click()}
                    disabled={status.status === 'processing'}
                    className="flex-1 px-3 py-2 bg-[#ffcc00] text-[#002b55] rounded-lg hover:bg-[#ffd633] transition-colors flex items-center justify-center gap-2 text-sm font-medium disabled:opacity-50"
                  >
                    <Upload className="w-4 h-4" />
                    Importar
                  </button>
                  <input
                    ref={(el) => (fileRefs.current[type] = el)}
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={(e) => handleFileChange(type, e)}
                    className="hidden"
                  />
                </div>

                <div className="pt-2 border-t border-gray-200">
                  <p className="text-xs text-gray-500">
                    <strong>Colunas:</strong> {config.columns.join(', ')}
                  </p>
                </div>
              </div>
            </MRSCard>
          );
        })}
      </div>
    </div>
  );
}
