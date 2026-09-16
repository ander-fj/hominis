import { useState, useEffect } from 'react';
import { Users, Calendar, Heart, GraduationCap, Palmtree, TrendingUp, TrendingDown, AlertCircle, CheckCircle, Download, Search, Camera } from 'lucide-react';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import MRSCard from './MRSCard';
import PeriodFilter from './PeriodFilter';
import { exportRankingToXLSX } from '../../lib/exportUtils';
import { calculateDateRange, getPeriodLabel } from '../../lib/dateUtils';
import html2canvas from 'html2canvas';

interface EmployeeDetails {
  id: string;
  name: string;
  email: string;
  department: string;
  position: string;
  hire_date: string;
  photo_url: string;
  absences: number;
  late_count: number;
  trainings_count: number;
  trainings_valid: number;
  exam_status: string;
  exam_date: string;
  exam_result: string;
  next_exam_date: string;
  vacation_start: string;
  vacation_end: string;
  vacation_status: string;
}

export default function TabelaDetalhada() {
  const [employees, setEmployees] = useState<EmployeeDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('this_month');
  const [customDateRange, setCustomDateRange] = useState<{ startDate: string; endDate: string } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [departments, setDepartments] = useState<string[]>([]);
  const [availablePeriods, setAvailablePeriods] = useState<{ value: string; label: string }[]>([]);

  useEffect(() => {
    loadEmployeeDetails();
  }, [selectedPeriod, customDateRange]);

  useEffect(() => {
    const fetchPeriods = async () => {
      const periodsQuery = query(collection(db, 'employee_rankings'), orderBy('period', 'desc'));
      const periodsSnapshot = await getDocs(periodsQuery);
      const periods = [...new Set(periodsSnapshot.docs.map(doc => doc.data().period as string))].filter(p => p !== 'consolidated');
      const periodOptionsMap = new Map();
      
      periods.forEach(p => {
        const label = new Date(p + 'T00:00:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
        if (!periodOptionsMap.has(label) || p.length > periodOptionsMap.get(label).value.length) {
          periodOptionsMap.set(label, { value: p, label });
        }
      });

      const periodOptions = Array.from(periodOptionsMap.values());
      setAvailablePeriods(periodOptions);
    };
    fetchPeriods();
  }, []);

  const loadEmployeeDetails = async () => {
    setLoading(true);
    try {
      let startDate: string, endDate: string;

      if (customDateRange) {
        startDate = customDateRange.startDate;
        endDate = customDateRange.endDate;
      } else {
        const dateRange = calculateDateRange(selectedPeriod);
        startDate = dateRange.startDate;
        endDate = dateRange.endDate;
      }

      // 1. Fetch all data in parallel
      const [
        employeesSnapshot,
        scoresSnapshot,
        trainingsSnapshot,
        examsSnapshot,
        vacationsSnapshot,
        criteriaSnapshot,
      ] = await Promise.all([
        getDocs(query(collection(db, 'employees'), where('active', '==', true))),
        getDocs(query(collection(db, 'employee_scores'), where('period', '>=', startDate), where('period', '<=', endDate))),
        getDocs(query(collection(db, 'sst_trainings'))), // Fetch all and filter by date client-side
        getDocs(query(collection(db, 'sst_medical_exams'))), // Fetch all and filter by date client-side
        getDocs(query(collection(db, 'vacation_records'))), // Fetch all and filter by date client-side
        getDocs(collection(db, 'evaluation_criteria')),
      ]);

      const employeesData = employeesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const scoresData = scoresSnapshot.docs.map(doc => doc.data());
      const trainingsData = trainingsSnapshot.docs.map(doc => doc.data());
      const examsData = examsSnapshot.docs.map(doc => doc.data());
      const vacationsData = vacationsSnapshot.docs.map(doc => doc.data());
      const criteriaMap = new Map(criteriaSnapshot.docs.map(doc => [doc.id, doc.data()]));
      const assiduityCriterionId = [...criteriaMap.entries()].find(([, crit]) => crit.name === 'Assiduidade')?.[0];
      const punctualityCriterionId = [...criteriaMap.entries()].find(([, crit]) => crit.name === 'Pontualidade')?.[0];

      if (employeesData.length === 0) {
        setEmployees([]);
        setLoading(false);
        return;
      }

      const depts = [...new Set(employeesData.map((e: any) => e.department))];
      setDepartments(depts);

      const detailedData = await Promise.all(
        employeesData.map(async (emp: any) => {
          const employeeScores = scoresData.filter(s => s.employee_id === emp.id);

          const assiduityScores = employeeScores.filter(s => {
            if (s.criterion_id !== assiduityCriterionId) return false;
            const value = parseFloat(s.raw_value);
            return !isNaN(value) && value >= 0 && value <= 100;
          }) || [];

          const punctualityScores = employeeScores.filter(s => {
            if (s.criterion_id !== punctualityCriterionId) return false;
            const value = parseFloat(s.raw_value);
            return !isNaN(value) && value >= 0;
          }) || [];

          let absences = 0;
          let lateCount = 0;
          assiduityScores.forEach(s => {
            const assiduity = parseFloat(s.raw_value);
            absences += Math.round((100 - assiduity) / 5);
          });
          punctualityScores.forEach(s => {
            lateCount += Math.round(parseFloat(s.raw_value));
          });

          const allTrainings = trainingsData.filter(t => t.employee_id === emp.id);
          const trainingsCount = allTrainings.length;
          const trainingsValid = allTrainings.filter(t => t.status === 'valid').length;

          const allExams = examsData
            .filter(e => e.employee_id === emp.id)
            .sort((a, b) => new Date(b.exam_date).getTime() - new Date(a.exam_date).getTime());
          const latestExam = allExams[0];

          const examsInPeriod = allExams.filter(e => {
            if (!e.exam_date) return false;
            const examDate = new Date(e.exam_date);
            return examDate >= new Date(startDate) && examDate <= new Date(endDate);
          }) || [];

          const allVacations = vacationsData
            .filter(v => v.employee_id === emp.id)
            .sort((a, b) => new Date(b.period_start).getTime() - new Date(a.period_start).getTime());

          const vacationInPeriod = allVacations.find(v => {
            if (!v.period_start) return false;
            const vacStart = new Date(v.period_start);
            const vacEnd = v.period_end ? new Date(v.period_end) : vacStart;
            const periodStart = new Date(startDate);
            const periodEnd = new Date(endDate);
            return (
              (vacStart >= periodStart && vacStart <= periodEnd) ||
              (vacEnd >= periodStart && vacEnd <= periodEnd) ||
              (vacStart <= periodStart && vacEnd >= periodEnd)
            );
          });

          return {
            id: emp.id,
            name: emp.name,
            email: emp.email,
            department: emp.department,
            position: emp.position,
            hire_date: emp.hire_date,
            photo_url: emp.photo_url || '',
            absences,
            late_count: lateCount,
            trainings_count: trainingsCount,
            trainings_valid: trainingsValid,
            exam_status: latestExam?.status || 'N/A',
            exam_date: latestExam?.exam_date || '',
            exam_result: latestExam?.result || '',
            next_exam_date: latestExam?.next_exam_date || '',
            vacation_start: vacationInPeriod?.period_start || '',
            vacation_end: vacationInPeriod?.period_end || '',
            vacation_status: vacationInPeriod?.status || 'N/A',
          };
        })
      );

      setEmployees(detailedData);
    } catch (error) {
      console.error('Erro ao carregar detalhes:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         emp.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         emp.department.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDepartment = departmentFilter === 'all' || emp.department === departmentFilter;
    return matchesSearch && matchesDepartment;
  });

  const stats = {
    totalAbsences: filteredEmployees.reduce((sum, emp) => sum + emp.absences, 0),
    totalLate: filteredEmployees.reduce((sum, emp) => sum + emp.late_count, 0),
    avgTrainings: filteredEmployees.length > 0
      ? (filteredEmployees.reduce((sum, emp) => sum + emp.trainings_count, 0) / filteredEmployees.length).toFixed(1)
      : '0',
    examsValid: filteredEmployees.filter(emp => emp.exam_status === 'valid').length,
    examsExpired: filteredEmployees.filter(emp => emp.exam_status === 'expired').length,
    vacationsInPeriod: filteredEmployees.filter(emp =>
      emp.vacation_start && emp.vacation_start !== '' &&
      (emp.vacation_status === 'scheduled' || emp.vacation_status === 'approved' || emp.vacation_status === 'in_progress')
    ).length,
  };

  const handleExport = () => {
    const exportData = filteredEmployees.map(emp => ({
      employee_name: emp.name,
      department: emp.department,
      position: emp.position,
      hire_date: emp.hire_date,
      absences_30days: emp.absences,
      late_count_30days: emp.late_count,
      trainings_total: emp.trainings_count,
      trainings_valid: emp.trainings_valid,
      exam_status: emp.exam_status,
      next_exam_date: emp.next_exam_date,
      vacation_status: emp.vacation_status,
      vacation_period: emp.vacation_start && emp.vacation_end
        ? `${emp.vacation_start} a ${emp.vacation_end}`
        : 'Não agendado',
      total_score: 0,
      rank_position: 0,
      criterion_scores: [],
      strengths: [],
      weaknesses: [],
      suggestions: [],
      employee_id: emp.id,
      employee_email: emp.email,
      photo_url: '',
    }));

    exportRankingToXLSX(exportData);
  };

  const handleScreenshot = async () => {
    try {
      const element = document.body;
      const canvas = await html2canvas(element, {
        backgroundColor: '#f9fafb',
        scale: 2,
        logging: false,
        useCORS: true,
      });

      const link = document.createElement('a');
      link.download = `dashboard-sst-${new Date().toISOString().split('T')[0]}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error('Erro ao capturar tela:', error);
      alert('Erro ao capturar tela. Tente novamente.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-[#ffcc00] mx-auto"></div>
          <p className="text-gray-600 mt-4 font-medium">Carregando dados...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#912325] flex items-center gap-3">
            <Users className="w-8 h-8 text-blue-600" />
            Tabela Detalhada de Colaboradores
          </h1>
          <p className="text-gray-600 mt-1">Visão completa de faltas, exames, treinamentos e férias</p>
        </div>
        <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
          <PeriodFilter
            selectedPeriod={selectedPeriod}
            onPeriodChange={setSelectedPeriod}
            onCustomRangeChange={(startDate, endDate) => {
              setCustomDateRange({ startDate, endDate });
            }}
            periods={availablePeriods}
            loading={loading}
          />
          <button
            onClick={handleScreenshot}
            className="px-4 py-2 bg-white border-2 border-gray-300 text-gray-700 rounded-lg hover:shadow-lg hover:bg-gray-50 transition-all flex items-center gap-2 font-semibold"
          >
            <Camera className="w-4 h-4" />
            Capturar Tela
          </button>
          <button
            onClick={handleExport}
            className="px-4 py-2 bg-gradient-to-r from-[#912325] to-[#701a1c] text-white font-semibold rounded-lg hover:shadow-lg transition-all flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Exportar Excel
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <MRSCard>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-red-600 rounded-lg flex items-center justify-center shadow-lg">
              <AlertCircle className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-xs text-gray-600">Faltas ({selectedPeriod ? getPeriodLabel(selectedPeriod) : 'Todos'})</p>
              <p className="text-2xl font-bold text-[#002b55]">{stats.totalAbsences}</p>
            </div>
          </div>
        </MRSCard>

        <MRSCard>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center shadow-lg">
              <TrendingDown className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-xs text-gray-600">Atrasos ({selectedPeriod ? getPeriodLabel(selectedPeriod) : 'Todos'})</p>
              <p className="text-2xl font-bold text-[#002b55]">{stats.totalLate}</p>
            </div>
          </div>
        </MRSCard>

        <MRSCard>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center shadow-lg">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-xs text-gray-600">Média Treinamentos ({selectedPeriod ? getPeriodLabel(selectedPeriod) : 'Todos'})</p>
              <p className="text-2xl font-bold text-[#002b55]">{stats.avgTrainings}</p>
            </div>
          </div>
        </MRSCard>

        <MRSCard>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center shadow-lg">
              <CheckCircle className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-xs text-gray-600">Exames Válidos</p>
              <p className="text-2xl font-bold text-[#002b55]">{stats.examsValid}</p>
            </div>
          </div>
        </MRSCard>

        <MRSCard>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-red-600 rounded-lg flex items-center justify-center shadow-lg">
              <Heart className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-xs text-gray-600">Exames Vencidos</p>
              <p className="text-2xl font-bold text-[#002b55]">{stats.examsExpired}</p>
            </div>
          </div>
        </MRSCard>

        <MRSCard>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-teal-500 to-teal-600 rounded-lg flex items-center justify-center shadow-lg">
              <Palmtree className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-xs text-gray-600">Férias ({selectedPeriod ? getPeriodLabel(selectedPeriod) : 'Todos'})</p>
              <p className="text-2xl font-bold text-[#002b55]">{stats.vacationsInPeriod}</p>
            </div>
          </div>
        </MRSCard>
      </div>

      <MRSCard>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Buscar por nome, email ou departamento..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#912325] focus:border-transparent"
              />
            </div>
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#912325] focus:border-transparent"
            >
              <option value="all">Todos os Departamentos</option>
              {departments.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gradient-to-r from-[#912325] to-[#701a1c] text-white">
                  <th className="px-4 py-3 text-left text-sm font-semibold">Colaborador</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Departamento</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold">Faltas</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold">Atrasos</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold">Treinamentos</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold">Resultado</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold">Próximo Exame</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold">Férias</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.map((emp, index) => (
                  <tr
                    key={emp.id}
                    className={`border-b border-gray-200 hover:bg-gray-50 transition-colors ${
                      index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-[#912325] to-[#701a1c] flex items-center justify-center shadow-md flex-shrink-0">
                          {emp.photo_url ? (
                            <img
                              src={emp.photo_url}
                              alt={emp.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                e.currentTarget.parentElement!.innerHTML = `<span class="text-white font-semibold text-sm">${emp.name.split(' ').map(n => n[0]).slice(0, 2).join('')}</span>`;
                              }}
                            />
                          ) : (
                            <span className="text-white font-semibold text-sm">
                              {emp.name.split(' ').map(n => n[0]).slice(0, 2).join('')}
                            </span>
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-[#912325]">{emp.name}</p>
                          <p className="text-xs text-gray-600">{emp.position}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                        {emp.department}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                        emp.absences === 0
                          ? 'bg-green-100 text-green-800'
                          : emp.absences <= 2
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {emp.absences}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                        emp.late_count === 0
                          ? 'bg-green-100 text-green-800'
                          : emp.late_count <= 2
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {emp.late_count}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <span className="font-semibold text-green-700">{emp.trainings_valid}</span>
                        <span className="text-gray-400">/</span>
                        <span className="text-gray-600">{emp.trainings_count}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {emp.exam_result && emp.exam_result !== '-' ? (
                        <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                          emp.exam_result === 'Apto'
                            ? 'bg-green-100 text-green-800'
                            : emp.exam_result.includes('restrições') || emp.exam_result === 'Apto com restrições'
                            ? 'bg-yellow-100 text-yellow-800'
                            : emp.exam_result === 'Inapto'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {emp.exam_result}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-sm">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center text-sm text-gray-700">
                      {emp.next_exam_date
                        ? new Date(emp.next_exam_date).toLocaleDateString('pt-BR')
                        : '-'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {emp.vacation_start && emp.vacation_end ? (
                        <div className="text-xs">
                          <p className="text-gray-600">
                            {new Date(emp.vacation_start).toLocaleDateString('pt-BR')} - {new Date(emp.vacation_end).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs">Não agendado</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredEmployees.length === 0 && (
            <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-12 flex flex-col items-center justify-center min-h-[400px]">
              <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-lg mb-6">
                <Users className="w-12 h-12 text-gray-400" />
              </div>
              <p className="text-xl font-bold text-gray-700 mb-2">Nenhum colaborador encontrado</p>
              <p className="text-gray-500 mb-6">Tente ajustar os filtros de busca ou período selecionado</p>
              <button
                onClick={() => {
                  setSearchTerm('');
                  setDepartmentFilter('all');
                }}
                className="px-6 py-2.5 bg-gradient-to-r from-[#912325] to-[#701a1c] text-white font-semibold rounded-lg hover:shadow-lg transition-all"
              >
                Limpar Filtros
              </button>
            </div>
          )}
        </div>
      </MRSCard>
    </div>
  );
}
