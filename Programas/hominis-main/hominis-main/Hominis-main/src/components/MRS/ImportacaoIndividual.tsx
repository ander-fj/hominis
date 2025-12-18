import { useState, useRef } from 'react';
import { Upload, FileSpreadsheet, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../../lib/supabase';
import MRSCard from './MRSCard';
import { calculateIntelligentRanking } from '../../lib/rankingEngine';

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
    columns: ['employee_id', 'period_start', 'period_end', 'days_taken', 'status']
  }
};

export default function ImportacaoIndividual() {
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

    try {
      // Verify employees exist for non-employee imports
      if (type !== 'colaboradores') {
        console.log(`[${type}] Verificando se existem colaboradores...`);

        const { data: employees, error: empError, count } = await supabase
          .from('employees')
          .select('id', { count: 'exact' })
          .limit(1);

        console.log(`[${type}] Resultado da verificação:`, {
          employees,
          error: empError,
          count,
          hasData: !!employees,
          length: employees?.length
        });

        if (empError) {
          console.error(`[${type}] Erro ao verificar colaboradores:`, empError);
          updateStatus(type, 'error', `Erro ao verificar colaboradores: ${empError.message}`, 0);
          return;
        }

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
            const { error } = await supabase
              .from('employees')
              .upsert({
                name: row.nome || row.name,
                email: row.email,
                department: row.departamento || row.department,
                position: row.cargo || row.position,
                hire_date: parseExcelDate(row.data_admissao || row.hire_date),
                photo_url: row.foto_url || row.photo_url || null
              }, { onConflict: 'email' });

            error ? errorCount++ : successCount++;
          }
          break;

        case 'avaliacoes':
          console.log(`Iniciando importação de ${rows.length} avaliações...`);

          const { data: criteria, error: critError } = await supabase
            .from('evaluation_criteria')
            .select('id, name');

          if (critError || !criteria || criteria.length === 0) {
            console.error('Critérios não encontrados');
            updateStatus(type, 'error', 'Critérios de avaliação não encontrados no sistema', 0);
            return;
          }

          const horasCriteria = criteria.find(c => c.name === 'Horas Trabalhadas');
          const faltasCriteria = criteria.find(c => c.name === 'Assiduidade');
          const atrasosCriteria = criteria.find(c => c.name === 'Pontualidade');

          for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            console.log(`Processando linha ${i + 1}/${rows.length}...`);

            try {
              const { data: employee, error: empError } = await supabase
                .from('employees')
                .select('id')
                .eq('email', row.employee_id)
                .maybeSingle();

              if (empError || !employee) {
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
                const { error: scoreError } = await supabase
                  .from('employee_scores')
                  .upsert(score, {
                    onConflict: 'employee_id,period,criterion_id'
                  });

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
            const { data: employee } = await supabase
              .from('employees')
              .select('id')
              .eq('email', row.employee_id)
              .maybeSingle();

            if (!employee) {
              errorCount++;
              continue;
            }

            const { error } = await supabase
              .from('sst_trainings')
              .insert({
                employee_id: employee.id,
                training_name: row.training_name,
                training_type: row.training_type || 'Segurança',
                completion_date: parseExcelDate(row.training_date),
                expiry_date: parseExcelDate(row.expiry_date),
                status: row.status === 'Concluído' ? 'valid' : 'pending'
              });

            error ? errorCount++ : successCount++;
          }
          break;

        case 'epis':
          for (const row of rows) {
            const { data: employee } = await supabase
              .from('employees')
              .select('id')
              .eq('email', row.employee_id)
              .maybeSingle();

            if (!employee) {
              errorCount++;
              continue;
            }

            const { error } = await supabase
              .from('sst_ppe')
              .insert({
                employee_id: employee.id,
                ppe_type: row.equipment_type,
                delivery_date: parseExcelDate(row.delivery_date),
                expiry_date: parseExcelDate(row.expiry_date),
                status: 'delivered',
                ca_number: row.ca_number,
                condition: row.condition || 'Novo'
              });

            error ? errorCount++ : successCount++;
          }
          break;

        case 'exames':
          for (const row of rows) {
            const { data: employee } = await supabase
              .from('employees')
              .select('id')
              .eq('email', row.employee_id)
              .maybeSingle();

            if (!employee) {
              errorCount++;
              continue;
            }

            const { error } = await supabase
              .from('sst_medical_exams')
              .insert({
                employee_id: employee.id,
                exam_type: row.exam_type || 'Admissional',
                exam_date: parseExcelDate(row.exam_date),
                next_exam_date: parseExcelDate(row.next_exam_date),
                status: 'valid',
                result: row.result || 'Apto'
              });

            error ? errorCount++ : successCount++;
          }
          break;

        case 'incidentes':
          for (const row of rows) {
            console.log('[incidentes] Processando linha:', row);
            console.log('[incidentes] Keys disponíveis:', Object.keys(row));

            const { data: employee } = await supabase
              .from('employees')
              .select('id, department')
              .eq('email', row.employee_id)
              .maybeSingle();

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
              incident_date: parseExcelDate(row.incident_date),
              incident_type: row.incident_type,
              severity: severity.toLowerCase(),
              description: row.description || '',
              department: employee.department,
              days_lost: row.days_lost || 0
            };

            console.log('[incidentes] Dados a serem inseridos:', incidentData);

            const { error } = await supabase
              .from('sst_incidents')
              .insert(incidentData);

            if (error) {
              console.error('Erro ao inserir incidente:', error);
              errorCount++;
            } else {
              successCount++;
            }
          }
          break;

        case 'ferias':
          for (const row of rows) {
            const { data: employee } = await supabase
              .from('employees')
              .select('id')
              .eq('email', row.employee_id)
              .maybeSingle();

            if (!employee) {
              errorCount++;
              continue;
            }

            const { error } = await supabase
              .from('vacation_records')
              .insert({
                employee_id: employee.id,
                period_start: parseExcelDate(row.period_start),
                period_end: parseExcelDate(row.period_end),
                days_taken: row.days_taken || 0,
                status: row.status || 'Planejado',
                notes: row.notes
              });

            error ? errorCount++ : successCount++;
          }
          break;
      }

      if (successCount > 0) {
        updateStatus(
          type,
          errorCount > 0 ? 'error' : 'success',
          errorCount > 0
            ? `${successCount} importados, ${errorCount} erros`
            : `${successCount} registros importados com sucesso!`,
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
              await calculateIntelligentRanking(period, false);
            }
            console.log('Rankings recalculados automaticamente');
          } catch (err) {
            console.error('Erro ao recalcular rankings:', err);
          }
        }
      } else {
        const errorMsg = type !== 'colaboradores' && errorCount > 0
          ? 'Colaboradores não encontrados. Importe primeiro a planilha de Colaboradores.'
          : `${errorCount} erros encontrados. Verifique o formato dos dados.`;
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
