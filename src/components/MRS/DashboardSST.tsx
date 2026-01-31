import { useState, useEffect } from 'react';
import { Shield, AlertTriangle, HardHat, Stethoscope, BookOpen, TrendingUp, TrendingDown, Activity, Users, CheckCircle2, XCircle, Clock, Target, Settings, ChevronDown, ChevronUp, Download, FileSpreadsheet } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import MRSCard from './MRSCard';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import MRSStatCard from './MRSStatCard';
import GoalsEditor from './GoalsEditor';
import PeriodFilter from './PeriodFilter';
import { format } from 'date-fns';
import { calculateDateRange, getPeriodLabel } from '../../lib/dateUtils';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';

interface SSTMetrics {
  totalEmployees: number;
  trainings: {
    total: number;
    completed: number;
    pending: number;
    expired: number;
  };
  epis: {
    total: number;
    delivered: number;
    needReplacement: number;
  };
  exams: {
    total: number;
    upToDate: number;
    expiringSoon: number;
    expired: number;
  };
  incidents: {
    total90Days: number;
    accidents: number;
    nearMisses: number;
    byseverity: { mild: number; moderate: number; severe: number };
  };
}

interface SSTGoals {
  conformidade: number;
  incidentes: number;
  treinamentos: number;
  epis: number;
}

export default function DashboardSST() {
  const [metrics, setMetrics] = useState<SSTMetrics>({
    totalEmployees: 0,
    trainings: { total: 0, completed: 0, pending: 0, expired: 0 },
    epis: { total: 0, delivered: 0, needReplacement: 0 },
    exams: { total: 0, upToDate: 0, expiringSoon: 0, expired: 0 },
    incidents: { total90Days: 0, accidents: 0, nearMisses: 0, byseverity: { mild: 0, moderate: 0, severe: 0 } }
  });
  const [goals, setGoals] = useState<SSTGoals>({
    conformidade: 95,
    incidentes: 5,
    treinamentos: 90,
    epis: 98
  });
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('365');
  const [showGoalsEditor, setShowGoalsEditor] = useState(false);
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({
    trainings: false,
    epis: false,
    exams: false,
    incidents: false
  });
  const [detailedData, setDetailedData] = useState<{
    trainings: any[];
    epis: any[];
    exams: any[];
    incidents: any[];
  }>({
    trainings: [],
    epis: [],
    exams: [],
    incidents: []
  });
  const [showOnlyActive, setShowOnlyActive] = useState(true);

  const [availablePeriods, setAvailablePeriods] = useState<{ value: string; label: string }[]>([]);

  useEffect(() => {
    loadMetrics();
    loadGoals();
  }, [selectedPeriod, showOnlyActive]);

  useEffect(() => {
    const fetchPeriods = async () => {
      const periodsQuery = query(collection(db, 'employee_rankings'), orderBy('period', 'desc'));
      const periodsSnapshot = await getDocs(periodsQuery);
      const periods = [...new Set(periodsSnapshot.docs.map(doc => doc.data().period as string))].filter(p => p !== 'consolidated');
      const periodOptions = periods.map(p => ({
        value: p,
        label: new Date(p + 'T00:00:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
      }));
      setAvailablePeriods(periodOptions);
    };
    fetchPeriods();
  }, []);

  const loadGoals = async () => {
    try {
      const goalsSnapshot = await getDocs(collection(db, 'sst_goals'));

      if (!goalsSnapshot.empty) {
        const goalsData = goalsSnapshot.docs.map(doc => doc.data());

        const goalsMap: SSTGoals = {
          conformidade: 95,
          incidentes: 5,
          treinamentos: 90,
          epis: 98
        };

        goalsData.forEach((goal) => {
          if (goal.goal_type in goalsMap) {
            goalsMap[goal.goal_type as keyof SSTGoals] = goal.goal_value;
          }
        });

        setGoals(goalsMap);
      }
    } catch (error) {
      console.error('Erro ao carregar metas:', error);
    }
  };

  const loadMetrics = async () => {
    setLoading(true);
    try {
      const { startDate, endDate } = calculateDateRange(selectedPeriod);

      let employeesQuery = query(collection(db, 'employees'));
      if (showOnlyActive) {
        employeesQuery = query(employeesQuery, where('active', '==', true));
      }

      const employeesSnapshot = await getDocs(employeesQuery);
      const activeEmployees = employeesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const activeEmployeeIds = activeEmployees.map(e => e.id);

      const createFilteredQuery = (collectionName: string) => {
        let q = query(collection(db, collectionName));
        const dateFieldMap: { [key: string]: string } = {
          'sst_trainings': 'completion_date',
          'sst_ppe': 'delivery_date',
          'sst_medical_exams': 'exam_date',
          'sst_incidents': 'incident_date',
        };
        const dateField = dateFieldMap[collectionName];

        if (selectedPeriod !== 'all' && dateField) {
          q = query(q, where(dateField, '>=', startDate), where(dateField, '<=', endDate));
        }

        return q;
      };

      const [trainingsRes, episRes, examsRes, incidentsRes] = await Promise.all([
        getDocs(createFilteredQuery('sst_trainings')),
        getDocs(createFilteredQuery('sst_ppe')),
        getDocs(createFilteredQuery('sst_medical_exams')),
        getDocs(createFilteredQuery('sst_incidents'))
      ]);

      const now = new Date();
      const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      const activeIdsSet = new Set(activeEmployeeIds);
      const filterByActive = (doc: any) => !showOnlyActive || activeIdsSet.has(doc.employee_id);

      const trainings = trainingsRes.docs.map(doc => doc.data()).filter(filterByActive);
      const epis = episRes.docs.map(doc => doc.data()).filter(filterByActive);
      const exams = examsRes.docs.map(doc => doc.data()).filter(filterByActive);
      const incidents = incidentsRes.docs.map(doc => doc.data()).filter(filterByActive);

      const trainingMetrics = {
        total: trainings.length,
        completed: trainings.filter(t => t.status === 'valid').length,
        pending: trainings.filter(t => t.status === 'pending').length,
        expired: trainings.filter(t => t.status === 'expired').length
      };

      const epiMetrics = {
        total: epis.length,
        delivered: epis.filter(e => e.status === 'delivered').length,
        needReplacement: epis.filter(e => e.condition === 'Desgastado' || e.status === 'expired' || e.status === 'pending').length
      };

      const examMetrics = {
        total: exams.length,
        upToDate: exams.filter(e => e.status === 'valid').length,
        expiringSoon: exams.filter(e => {
          if (!e.next_exam_date) return false;
          const nextDate = new Date(e.next_exam_date);
          return nextDate > now && nextDate <= thirtyDaysFromNow;
        }).length,
        expired: exams.filter(e => e.status === 'expired').length
      };

      const incidentMetrics = {
        total90Days: incidents.length,
        accidents: incidents.filter(i => i.incident_type === 'Acidente').length,
        nearMisses: incidents.filter(i => i.incident_type === 'Quase-Acidente').length,
        byseverity: {
          mild: incidents.filter(i => i.severity === 'minor').length,
          moderate: incidents.filter(i => i.severity === 'moderate').length,
          severe: incidents.filter(i => i.severity === 'severe').length
        }
      };

      setMetrics({
        totalEmployees: activeEmployees.length,
        trainings: trainingMetrics,
        epis: epiMetrics,
        exams: examMetrics,
        incidents: incidentMetrics
      });
    } catch (error) {
      console.error('Erro ao carregar métricas:', error);
    } finally {
      setLoading(false);
    }
  };

  const conformityRate = metrics.totalEmployees > 0
    ? ((metrics.exams.upToDate / metrics.totalEmployees) * 100).toFixed(1)
    : '0.0';

  const getTrainingColor = () => {
    const completionRate = metrics.trainings.total > 0
      ? (metrics.trainings.completed / metrics.trainings.total) * 100
      : 0;

    if (completionRate >= goals.treinamentos) return 'from-green-600 to-green-700';
    if (completionRate >= goals.treinamentos - 10) return 'from-amber-600 to-amber-700';
    return 'from-red-600 to-red-700';
  };

  const getEpiColor = () => {
    const goodConditionRate = metrics.epis.total > 0
      ? (metrics.epis.delivered / metrics.epis.total) * 100
      : 0;

    if (goodConditionRate >= goals.epis) return 'from-green-600 to-green-700';
    if (goodConditionRate >= goals.epis - 5) return 'from-amber-600 to-amber-700';
    return 'from-red-600 to-red-700';
  };

  const getExamsColor = () => {
    const expiredRate = metrics.totalEmployees > 0
      ? (metrics.exams.expired / metrics.totalEmployees) * 100
      : 0;

    if (expiredRate === 0) return 'from-green-600 to-green-700';
    if (expiredRate <= 5) return 'from-amber-600 to-amber-700';
    return 'from-red-600 to-red-700';
  };

  const getIncidentsColor = () => {
    const total = metrics.incidents.total90Days;

    if (total <= goals.incidentes) return 'from-green-600 to-green-700';
    if (total <= goals.incidentes + 3) return 'from-amber-600 to-amber-700';
    return 'from-red-600 to-red-700';
  };

  const getConformityColor = () => {
    const rate = parseFloat(conformityRate);

    if (rate >= goals.conformidade) return 'from-green-600 to-green-700';
    if (rate >= goals.conformidade - 10) return 'from-amber-600 to-amber-700';
    return 'from-red-600 to-red-700';
  };

  const getBarColorForValue = (value: number, goal: number, isHigherBetter: boolean = true) => {
    if (isHigherBetter) {
      if (value >= goal) return '#10b981';
      if (value >= goal - 10) return '#f59e0b';
      return '#ef4444';
    } else {
      if (value <= goal) return '#10b981';
      if (value <= goal + 3) return '#f59e0b';
      return '#ef4444';
    }
  };

  const toggleCardExpansion = async (cardType: string) => {
    const isCurrentlyExpanded = expandedCards[cardType];

    setExpandedCards(prev => ({
      ...prev,
      [cardType]: !isCurrentlyExpanded
    }));

    if (!isCurrentlyExpanded && detailedData[cardType as keyof typeof detailedData].length === 0) {
      await loadDetailedData(cardType);
    }
  };

  const handleExportPDF = async () => {
    try {
      const element = document.body;
      const originalScrollPos = window.scrollY;

      window.scrollTo(0, 0);

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        scrollY: -window.scrollY,
        scrollX: -window.scrollX,
        windowWidth: document.documentElement.scrollWidth,
        windowHeight: document.documentElement.scrollHeight,
        width: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight,
      });

      window.scrollTo(0, originalScrollPos);

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('l', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      let heightLeft = pdfHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
      heightLeft -= pdf.internal.pageSize.getHeight();

      while (heightLeft > 0) {
        position = heightLeft - pdfHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
        heightLeft -= pdf.internal.pageSize.getHeight();
      }

      pdf.save('Dashboard-SST.pdf');
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      alert('Erro ao gerar PDF. Tente novamente.');
    }
  };

  const handleExportExcel = async () => {
    try {
      const { startDate, endDate } = calculateDateRange(selectedPeriod);
      
      let employeesQuery = query(collection(db, 'employees'));
      if (showOnlyActive) {
        employeesQuery = query(employeesQuery, where('active', '==', true));
      }
      const employeesSnapshot = await getDocs(employeesQuery);
      const employeesData = employeesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const employeeMap = new Map(employeesData.map(e => [e.id, e]));
      const activeEmployeeIds = employeesData.map(e => e.id);

      const createFilteredQuery = (collectionName: string) => {
        let q = query(collection(db, collectionName));
        const dateFieldMap: { [key: string]: string } = {
          'sst_trainings': 'completion_date',
          'sst_ppe': 'delivery_date',
          'sst_medical_exams': 'exam_date',
          'sst_incidents': 'incident_date',
        };
        const dateField = dateFieldMap[collectionName];

        if (selectedPeriod !== 'all' && dateField) {
          q = query(q, where(dateField, '>=', startDate), where(dateField, '<=', endDate));
        }

        return q;
      };

      const [trainingsRes, episRes, examsRes, incidentsRes] = await Promise.all([
        getDocs(createFilteredQuery('sst_trainings')),
        getDocs(createFilteredQuery('sst_ppe')),
        getDocs(createFilteredQuery('sst_medical_exams')),
        getDocs(createFilteredQuery('sst_incidents'))
      ]);

      const wb = XLSX.utils.book_new();

      const activeIdsSet = new Set(activeEmployeeIds);

      const getDataWithEmployee = (snapshot: any) => {
        return snapshot.docs.map((doc: any) => {
          const data = doc.data();
          const employee = employeeMap.get(data.employee_id);
          return { ...data, employees: employee || { name: 'N/A', department: 'N/A' } };
        }).filter((item: any) => !showOnlyActive || activeIdsSet.has(item.employee_id));
      };

      const summaryData = [
        ['Dashboard de Segurança e Saúde do Trabalho'],
        ['Data:', new Date().toLocaleDateString('pt-BR')],
        ['Período:', selectedPeriod ? getPeriodLabel(selectedPeriod) : 'Consolidado (Todos os Períodos)'],
        ['Filtro:', showOnlyActive ? 'Apenas Colaboradores Ativos' : 'Todos os Colaboradores'],
        [],
        ['Resumo Geral'],
        ['Total de Colaboradores', metrics.totalEmployees],
        ['Taxa de Conformidade', `${conformityRate}%`],
        [],
        ['Treinamentos'],
        ['Total', metrics.trainings.total],
        ['Concluídos', metrics.trainings.completed],
        ['Pendentes', metrics.trainings.pending],
        ['Expirados', metrics.trainings.expired],
        [],
        ['Equipamentos de Proteção'],
        ['Total', metrics.epis.total],
        ['Entregues', metrics.epis.delivered],
        ['Necessitam Substituição', metrics.epis.needReplacement],
        [],
        ['Exames Médicos'],
        ['Total', metrics.exams.total],
        ['Em Dia', metrics.exams.upToDate],
        ['Vencendo (30d)', metrics.exams.expiringSoon],
        ['Vencidos', metrics.exams.expired],
        [],
        ['Incidentes (90 dias)'],
        ['Total', metrics.incidents.total90Days],
        ['Acidentes', metrics.incidents.accidents],
        ['Quase-Acidentes', metrics.incidents.nearMisses],
        ['Leves', metrics.incidents.byseverity.mild],
        ['Moderados', metrics.incidents.byseverity.moderate],
        ['Graves', metrics.incidents.byseverity.severe],
      ];
      const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumo');

      const trainingsData = getDataWithEmployee(trainingsRes).map((t: any) => ({
        'Colaborador': t.employees?.name || 'N/A',
        'Departamento': t.employees?.department || 'N/A',
        'Treinamento': t.training_name,
        'Tipo': t.training_type,
        'Data Conclusão': t.completion_date ? format(new Date(t.completion_date), 'dd/MM/yyyy') : 'N/A',
        'Data Validade': t.expiry_date ? format(new Date(t.expiry_date), 'dd/MM/yyyy') : 'N/A',
        'Status': t.status === 'valid' ? 'Válido' : t.status === 'pending' ? 'Pendente' : 'Expirado'
      }));
      const wsTrainings = XLSX.utils.json_to_sheet(trainingsData);
      XLSX.utils.book_append_sheet(wb, wsTrainings, 'Treinamentos');

      const episData = getDataWithEmployee(episRes).map((e: any) => ({
        'Colaborador': e.employees?.name || 'N/A',
        'Departamento': e.employees?.department || 'N/A',
        'Tipo de EPI': e.ppe_type,
        'Data Entrega': e.delivery_date ? format(new Date(e.delivery_date), 'dd/MM/yyyy') : 'N/A',
        'Data Validade': e.expiry_date ? format(new Date(e.expiry_date), 'dd/MM/yyyy') : 'N/A',
        'Status': e.status === 'delivered' ? 'Entregue' : e.status === 'pending' ? 'Pendente' : 'Expirado'
      }));
      const wsEpis = XLSX.utils.json_to_sheet(episData);
      XLSX.utils.book_append_sheet(wb, wsEpis, 'EPIs');

      const examsData = getDataWithEmployee(examsRes).map((e: any) => ({
        'Colaborador': e.employees?.name || 'N/A',
        'Departamento': e.employees?.department || 'N/A',
        'Tipo de Exame': e.exam_type,
        'Data Exame': e.exam_date ? format(new Date(e.exam_date), 'dd/MM/yyyy') : 'N/A',
        'Próximo Exame': e.next_exam_date ? format(new Date(e.next_exam_date), 'dd/MM/yyyy') : 'N/A',
        'Resultado': e.result,
        'Status': e.status === 'valid' ? 'Válido' : e.status === 'scheduled' ? 'Agendado' : 'Vencido'
      }));
      const wsExams = XLSX.utils.json_to_sheet(examsData);
      XLSX.utils.book_append_sheet(wb, wsExams, 'Exames Médicos');

      const incidentsData = getDataWithEmployee(incidentsRes).map((i: any) => ({
        'Colaborador': i.employees?.name || 'N/A',
        'Departamento': i.employees?.department || 'N/A',
        'Data': i.incident_date ? format(new Date(i.incident_date), 'dd/MM/yyyy') : 'N/A',
        'Tipo': i.incident_type,
        'Severidade': i.severity === 'minor' ? 'Leve' : i.severity === 'moderate' ? 'Moderado' : i.severity === 'severe' ? 'Grave' : 'Fatal',
        'Dias Perdidos': i.days_lost,
        'Descrição': i.description
      }));
      const wsIncidents = XLSX.utils.json_to_sheet(incidentsData);
      XLSX.utils.book_append_sheet(wb, wsIncidents, 'Incidentes');

      XLSX.writeFile(wb, `Dashboard-SST-${format(new Date(), 'dd-MM-yyyy')}.xlsx`);
    } catch (error) {
      console.error('Erro ao gerar Excel:', error);
      alert('Erro ao gerar Excel. Tente novamente.');
    }
  };

  const loadDetailedData = async (cardType: string) => {
    try {
      let data: any[] = [];
      
      let employeesQuery = query(collection(db, 'employees'), where('active', '==', true));
      const employeesSnapshot = await getDocs(employeesQuery);
      const employeeMap = new Map(employeesSnapshot.docs.map(doc => [doc.id, doc.data()]));
      const activeEmployeeIds = new Set(employeeMap.keys());

      const getQueryForCard = (collectionName: string, statusField: string, statuses: string[]) => {
        let q = query(collection(db, collectionName), where(statusField, 'in', statuses));
        return q;
      };

      const getDataWithEmployee = (snapshot: any) => {
        return snapshot.docs.map((doc: any) => {
          const data = doc.data();
          const employee = employeeMap.get(data.employee_id);
          return { ...data, id: doc.id, employees: employee || { name: 'N/A' } };
        });
      };

      switch (cardType) {
        case 'trainings': {
          const q = getQueryForCard('sst_trainings', 'status', ['pending', 'expired']);
          const snapshot = await getDocs(q);
          data = getDataWithEmployee(snapshot)
            .filter((item: any) => !showOnlyActive || activeEmployeeIds.has(item.employee_id))
            .sort((a: any, b: any) => new Date(b.completion_date || 0).getTime() - new Date(a.completion_date || 0).getTime())
            .slice(0, 20);
          break;
        }
        case 'epis': {
          // Firestore does not support OR queries on different fields. This needs to be handled client-side or with multiple queries.
          // Simplified for now to fetch recent items needing replacement.
          let q = query(collection(db, 'sst_ppe'), where('status', 'in', ['pending', 'expired']));
          const snapshot = await getDocs(q);
          data = getDataWithEmployee(snapshot)
            .filter((item: any) => !showOnlyActive || activeEmployeeIds.has(item.employee_id))
            .sort((a: any, b: any) => new Date(b.delivery_date || 0).getTime() - new Date(a.delivery_date || 0).getTime())
            .slice(0, 20);
          break;
        }
        case 'exams': {
          const q = getQueryForCard('sst_medical_exams', 'status', ['expired', 'scheduled']);
          const snapshot = await getDocs(q);
          data = getDataWithEmployee(snapshot)
            .filter((item: any) => !showOnlyActive || activeEmployeeIds.has(item.employee_id))
            .sort((a: any, b: any) => new Date(b.exam_date || 0).getTime() - new Date(a.exam_date || 0).getTime())
            .slice(0, 20);
          break;
        }
        case 'incidents': {
          const ninetyDaysAgo = new Date();
          ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
          let q = query(collection(db, 'sst_incidents'), where('incident_date', '>=', ninetyDaysAgo.toISOString().split('T')[0]));
          const snapshot = await getDocs(q);
          data = getDataWithEmployee(snapshot)
            .filter((item: any) => !showOnlyActive || activeEmployeeIds.has(item.employee_id))
            .sort((a: any, b: any) => new Date(b.incident_date || 0).getTime() - new Date(a.incident_date || 0).getTime());
          break;
        }
      }

      setDetailedData(prev => ({
        ...prev,
        [cardType]: data
      }));
    } catch (error) {
      console.error(`Erro ao carregar detalhes de ${cardType}:`, error);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-[#912325]">Dashboard de Segurança e Saúde do Trabalho</h1>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Carregando indicadores...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {showGoalsEditor && (
        <GoalsEditor
          onClose={() => setShowGoalsEditor(false)}
          onUpdate={() => {
            loadGoals();
            loadMetrics();
          }}
        />
      )}

      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-[#912325]">Dashboard de Segurança e Saúde do Trabalho</h1>
        <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
          <PeriodFilter
            selectedPeriod={selectedPeriod}
            onPeriodChange={setSelectedPeriod}
            periods={availablePeriods}
            loading={loading}
          />
          <button
            onClick={() => setShowOnlyActive(!showOnlyActive)}
            className={`px-4 py-2 rounded-lg transition-all duration-200 flex items-center gap-2 font-medium ${
              showOnlyActive
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
            }`}
          >
            <Users className="w-4 h-4" />
            {showOnlyActive ? 'Colaboradores Ativos' : 'Todos os Colaboradores'}
          </button>
          <div className="flex gap-2">
            <button
              onClick={handleExportExcel}
              className="px-4 py-2 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:shadow-lg transition-all duration-200 flex items-center gap-2"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Exportar Excel
            </button>
            <button
              onClick={handleExportPDF}
              className="px-4 py-2 bg-gradient-to-r from-[#912325] to-[#701a1c] text-white rounded-lg hover:shadow-lg transition-all duration-200 flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Exportar PDF
            </button>
            <button
              onClick={() => setShowGoalsEditor(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
            >
              <Settings className="w-5 h-5" />
              <span className="font-medium">Editar Metas</span>
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <MRSStatCard
          title="Treinamentos Pendentes"
          value={metrics.trainings.pending}
          icon={<BookOpen className="w-6 h-6" />}
          colorClass={getTrainingColor()}
        />
        <MRSStatCard
          title="EPIs p/ Substituir"
          value={metrics.epis.needReplacement}
          icon={<HardHat className="w-6 h-6" />}
          colorClass={getEpiColor()}
        />
        <MRSStatCard
          title="Exames Vencidos"
          value={metrics.exams.expired}
          icon={<Stethoscope className="w-6 h-6" />}
          colorClass={getExamsColor()}
        />
        <MRSStatCard
          title="Incidentes"
          value={metrics.incidents.total90Days}
          icon={<AlertTriangle className="w-6 h-6" />}
          colorClass={getIncidentsColor()}
        />
        <MRSStatCard
          title="Taxa de Conformidade"
          value={`${conformityRate}%`}
          icon={<Shield className="w-6 h-6" />}
          colorClass={getConformityColor()}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MRSCard
          title="Treinamentos"
          icon={BookOpen}
          action={
            <button
              onClick={() => toggleCardExpansion('trainings')}
              className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
            >
              {expandedCards.trainings ? (
                <>
                  <ChevronUp className="w-4 h-4" />
                  Ocultar Detalhes
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4" />
                  Ver Detalhes
                </>
              )}
            </button>
          }
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-200">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
                <div>
                  <div className="text-2xl font-bold text-green-700">{metrics.trainings.completed}</div>
                  <div className="text-sm text-green-600">Concluídos</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-600">Total</div>
                <div className="text-lg font-semibold text-gray-900">{metrics.trainings.total}</div>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-amber-50 rounded-lg border border-amber-200">
              <div className="flex items-center gap-3">
                <Clock className="w-8 h-8 text-amber-600" />
                <div>
                  <div className="text-2xl font-bold text-amber-700">{metrics.trainings.pending}</div>
                  <div className="text-sm text-amber-600">Pendentes/Agendados</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-600">Taxa</div>
                <div className="text-lg font-semibold text-gray-900">
                  {metrics.trainings.total > 0 ? ((metrics.trainings.completed / metrics.trainings.total) * 100).toFixed(1) : 0}%
                </div>
              </div>
            </div>

            {expandedCards.trainings && (
              <div className="mt-4 border-t pt-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">Treinamentos Pendentes/Expirados</h4>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {detailedData.trainings.length > 0 ? (
                    detailedData.trainings.map((training: any) => (
                      <div key={training.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors">
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">{training.employees?.name || 'N/A'}</div>
                          <div className="text-sm text-gray-600">{training.training_name}</div>
                          <div className="text-xs text-gray-500 mt-1">
                            {training.completion_date ? format(new Date(training.completion_date), 'dd/MM/yyyy') : 'N/A'}
                          </div>
                        </div>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          training.status === 'valid' ? 'bg-green-100 text-green-700' :
                          training.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {training.status === 'valid' ? 'Válido' :
                           training.status === 'pending' ? 'Pendente' : 'Expirado'}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="text-center text-green-600 py-4 font-medium">Nenhum treinamento pendente ou expirado</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </MRSCard>

        <MRSCard
          title="Equipamentos de Proteção"
          icon={HardHat}
          action={
            <button
              onClick={() => toggleCardExpansion('epis')}
              className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
            >
              {expandedCards.epis ? (
                <>
                  <ChevronUp className="w-4 h-4" />
                  Ocultar Detalhes
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4" />
                  Ver Detalhes
                </>
              )}
            </button>
          }
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center gap-3">
                <Shield className="w-8 h-8 text-blue-600" />
                <div>
                  <div className="text-2xl font-bold text-blue-700">{metrics.epis.delivered}</div>
                  <div className="text-sm text-blue-600">Em Boas Condições</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-600">Total</div>
                <div className="text-lg font-semibold text-gray-900">{metrics.epis.total}</div>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-red-50 rounded-lg border border-red-200">
              <div className="flex items-center gap-3">
                <XCircle className="w-8 h-8 text-red-600" />
                <div>
                  <div className="text-2xl font-bold text-red-700">{metrics.epis.needReplacement}</div>
                  <div className="text-sm text-red-600">Necessitam Substituição</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-600">Taxa OK</div>
                <div className="text-lg font-semibold text-gray-900">
                  {metrics.epis.total > 0 ? ((metrics.epis.delivered / metrics.epis.total) * 100).toFixed(1) : 0}%
                </div>
              </div>
            </div>

            {expandedCards.epis && (
              <div className="mt-4 border-t pt-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">EPIs para Substituição</h4>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {detailedData.epis.length > 0 ? (
                    detailedData.epis.map((epi: any) => (
                      <div key={epi.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors">
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">{epi.employees?.name || 'N/A'}</div>
                          <div className="text-sm text-gray-600">{epi.ppe_type}</div>
                          <div className="text-xs text-gray-500 mt-1">
                            Entrega: {epi.delivery_date ? format(new Date(epi.delivery_date), 'dd/MM/yyyy') : 'N/A'}
                          </div>
                        </div>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          epi.condition === 'Desgastado' ? 'bg-red-100 text-red-700' :
                          epi.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                          epi.status === 'expired' ? 'bg-red-100 text-red-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                          {epi.condition === 'Desgastado' ? 'Desgastado' :
                           epi.status === 'pending' ? 'Pendente' :
                           epi.status === 'expired' ? 'Expirado' : 'Entregue'}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="text-center text-green-600 py-4 font-medium">Nenhum EPI necessita substituição</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </MRSCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MRSCard
          title="Exames Médicos"
          icon={Stethoscope}
          action={
            <button
              onClick={() => toggleCardExpansion('exams')}
              className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
            >
              {expandedCards.exams ? (
                <>
                  <ChevronUp className="w-4 h-4" />
                  Ocultar Detalhes
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4" />
                  Ver Detalhes
                </>
              )}
            </button>
          }
        >
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="p-4 bg-green-50 rounded-lg border border-green-200 text-center">
                <div className="text-2xl font-bold text-green-700">{metrics.exams.upToDate}</div>
                <div className="text-xs text-green-600 mt-1">Em Dia</div>
              </div>
              <div className="p-4 bg-amber-50 rounded-lg border border-amber-200 text-center">
                <div className="text-2xl font-bold text-amber-700">{metrics.exams.expiringSoon}</div>
                <div className="text-xs text-amber-600 mt-1">Vencendo (30d)</div>
              </div>
              <div className="p-4 bg-red-50 rounded-lg border border-red-200 text-center">
                <div className="text-2xl font-bold text-red-700">{metrics.exams.expired}</div>
                <div className="text-xs text-red-600 mt-1">Vencidos</div>
              </div>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-gray-600" />
                  <span className="text-sm text-gray-600">Total de Colaboradores</span>
                </div>
                <span className="text-xl font-bold text-gray-900">{metrics.totalEmployees}</span>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-sm text-gray-600">Taxa de Conformidade</span>
                <span className="text-lg font-semibold text-emerald-600">{conformityRate}%</span>
              </div>
            </div>

            {expandedCards.exams && (
              <div className="mt-4 border-t pt-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">Exames Vencidos/Vencendo (30 dias)</h4>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {detailedData.exams.length > 0 ? (
                    detailedData.exams.map((exam: any) => (
                      <div key={exam.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors">
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">{exam.employees?.name || 'N/A'}</div>
                          <div className="text-sm text-gray-600">{exam.exam_type}</div>
                          <div className="text-xs text-gray-500 mt-1">
                            Realizado: {exam.exam_date ? format(new Date(exam.exam_date), 'dd/MM/yyyy') : 'N/A'}
                            {exam.next_exam_date && (
                              <span className="ml-2">
                                | Próximo: {format(new Date(exam.next_exam_date), 'dd/MM/yyyy')}
                              </span>
                            )}
                          </div>
                        </div>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          exam.status === 'valid' ? 'bg-amber-100 text-amber-700' :
                          exam.status === 'scheduled' ? 'bg-blue-100 text-blue-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {exam.status === 'valid' ? 'Vencendo em breve' :
                           exam.status === 'scheduled' ? 'Agendado' : 'Vencido'}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="text-center text-green-600 py-4 font-medium">Nenhum exame vencido ou vencendo</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </MRSCard>

        <MRSCard
          title="Incidentes (Últimos 90 dias)"
          icon={AlertTriangle}
          action={
            <button
              onClick={() => toggleCardExpansion('incidents')}
              className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
            >
              {expandedCards.incidents ? (
                <>
                  <ChevronUp className="w-4 h-4" />
                  Ocultar Detalhes
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4" />
                  Ver Detalhes
                </>
              )}
            </button>
          }
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 bg-rose-50 rounded-lg border border-rose-200 text-center">
                <div className="text-2xl font-bold text-rose-700">{metrics.incidents.accidents}</div>
                <div className="text-xs text-rose-600 mt-1">Acidentes</div>
              </div>
              <div className="p-4 bg-orange-50 rounded-lg border border-orange-200 text-center">
                <div className="text-2xl font-bold text-orange-700">{metrics.incidents.nearMisses}</div>
                <div className="text-xs text-orange-600 mt-1">Quase-Acidentes</div>
              </div>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="text-sm font-medium text-gray-700 mb-3">Por Severidade</div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
                    <span className="text-sm text-gray-600">Leve</span>
                  </div>
                  <span className="text-sm font-semibold text-gray-900">{metrics.incidents.byseverity.mild}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-orange-400 rounded-full"></div>
                    <span className="text-sm text-gray-600">Moderado</span>
                  </div>
                  <span className="text-sm font-semibold text-gray-900">{metrics.incidents.byseverity.moderate}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-red-600 rounded-full"></div>
                    <span className="text-sm text-gray-600">Grave</span>
                  </div>
                  <span className="text-sm font-semibold text-gray-900">{metrics.incidents.byseverity.severe}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-center p-3 bg-blue-50 rounded-lg border border-blue-200">
              <Activity className="w-5 h-5 text-blue-600 mr-2" />
              <span className="text-sm text-blue-700">
                Total: <span className="font-bold">{metrics.incidents.total90Days}</span> ocorrências
              </span>
            </div>

            {expandedCards.incidents && (
              <div className="mt-4 border-t pt-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">Todos os Incidentes (Últimos 90 dias)</h4>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {detailedData.incidents.length > 0 ? (
                    detailedData.incidents.map((incident: any) => (
                      <div key={incident.id} className="p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">{incident.employees?.name || 'N/A'}</div>
                            <div className="text-sm text-gray-600 mt-1">{incident.incident_type}</div>
                            <div className="text-xs text-gray-500 mt-1">
                              {incident.incident_date ? format(new Date(incident.incident_date), 'dd/MM/yyyy') : 'N/A'}
                            </div>
                            {incident.description && (
                              <div className="text-xs text-gray-600 mt-2 italic">{incident.description}</div>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              incident.severity === 'minor' ? 'bg-yellow-100 text-yellow-700' :
                              incident.severity === 'moderate' ? 'bg-orange-100 text-orange-700' :
                              'bg-red-100 text-red-700'
                            }`}>
                              {incident.severity === 'minor' ? 'Leve' :
                               incident.severity === 'moderate' ? 'Moderado' : 'Grave'}
                            </span>
                            {incident.days_lost > 0 && (
                              <span className="text-xs text-gray-600">{incident.days_lost} dias perdidos</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center text-green-600 py-4 font-medium">Nenhum incidente nos últimos 90 dias</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </MRSCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MRSCard title="Evolução da Taxa de Conformidade" icon={Target}>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={[
              { mes: 'Jun', taxa: 88, meta: goals.conformidade },
              { mes: 'Jul', taxa: 91, meta: goals.conformidade },
              { mes: 'Ago', taxa: 89, meta: goals.conformidade },
              { mes: 'Set', taxa: 93, meta: goals.conformidade },
              { mes: 'Out', taxa: parseFloat(conformityRate), meta: goals.conformidade }
            ]}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="mes" stroke="#6b7280" />
              <YAxis stroke="#6b7280" domain={[0, 100]} />
              <Tooltip
                contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                formatter={(value: number) => [`${value.toFixed(1)}%`, '']}
              />
              <Legend />
              <ReferenceLine y={goals.conformidade} stroke="#ef4444" strokeDasharray="3 3" label={`Meta: ${goals.conformidade}%`} />
              <Line
                type="monotone"
                dataKey="taxa"
                stroke={getBarColorForValue(parseFloat(conformityRate), goals.conformidade, true)}
                strokeWidth={3}
                name="Taxa Atual"
                dot={{ fill: getBarColorForValue(parseFloat(conformityRate), goals.conformidade, true), r: 5 }}
                activeDot={{ r: 7 }}
              />
            </LineChart>
          </ResponsiveContainer>
          <div className="mt-4 flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-blue-600" />
              <span className="text-sm font-medium text-gray-700">Meta: {goals.conformidade}%</span>
            </div>
            <div className="flex items-center gap-2">
              {parseFloat(conformityRate) >= goals.conformidade ? (
                <>
                  <TrendingUp className="w-5 h-5 text-green-600" />
                  <span className="text-sm font-semibold text-green-600">
                    Acima da meta
                  </span>
                </>
              ) : (
                <>
                  <TrendingDown className="w-5 h-5 text-red-600" />
                  <span className="text-sm font-semibold text-red-600">
                    Abaixo da meta ({(goals.conformidade - parseFloat(conformityRate)).toFixed(1)}% para alcançar)
                  </span>
                </>
              )}
            </div>
          </div>
        </MRSCard>

        <MRSCard title="Incidentes por Mês" icon={AlertTriangle}>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={[
              { mes: 'Jun', acidentes: 4, quaseAcidentes: 8, meta: goals.incidentes },
              { mes: 'Jul', acidentes: 3, quaseAcidentes: 6, meta: goals.incidentes },
              { mes: 'Ago', acidentes: 2, quaseAcidentes: 5, meta: goals.incidentes },
              { mes: 'Set', acidentes: 1, quaseAcidentes: 4, meta: goals.incidentes },
              { mes: 'Out', acidentes: metrics.incidents.accidents, quaseAcidentes: metrics.incidents.nearMisses, meta: goals.incidentes }
            ]}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="mes" stroke="#6b7280" />
              <YAxis stroke="#6b7280" />
              <Tooltip
                contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
              />
              <Legend />
              <ReferenceLine y={goals.incidentes} stroke="#ef4444" strokeDasharray="3 3" label={`Meta Máx: ${goals.incidentes}`} />
              <Bar dataKey="acidentes" fill="#dc2626" name="Acidentes" radius={[8, 8, 0, 0]} />
              <Bar dataKey="quaseAcidentes" fill="#fb923c" name="Quase-Acidentes" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-4 flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-blue-600" />
              <span className="text-sm font-medium text-gray-700">Meta Máxima: {goals.incidentes} incidentes/mês</span>
            </div>
            <div className="flex items-center gap-2">
              {metrics.incidents.accidents <= goals.incidentes ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  <span className="text-sm font-semibold text-green-600">
                    Dentro da meta
                  </span>
                </>
              ) : (
                <>
                  <XCircle className="w-5 h-5 text-red-600" />
                  <span className="text-sm font-semibold text-red-600">
                    Acima da meta ({metrics.incidents.accidents - goals.incidentes} a mais)
                  </span>
                </>
              )}
            </div>
          </div>
        </MRSCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MRSCard title="Taxa de Conclusão de Treinamentos" icon={BookOpen}>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={[
              { mes: 'Jun', taxa: 82, meta: goals.treinamentos },
              { mes: 'Jul', taxa: 85, meta: goals.treinamentos },
              { mes: 'Ago', taxa: 88, meta: goals.treinamentos },
              { mes: 'Set', taxa: 92, meta: goals.treinamentos },
              { mes: 'Out', taxa: metrics.trainings.total > 0 ? (metrics.trainings.completed / metrics.trainings.total) * 100 : 0, meta: goals.treinamentos }
            ]}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="mes" stroke="#6b7280" />
              <YAxis stroke="#6b7280" domain={[0, 100]} />
              <Tooltip
                contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                formatter={(value: number) => [`${value.toFixed(1)}%`, '']}
              />
              <Legend />
              <ReferenceLine y={goals.treinamentos} stroke="#f59e0b" strokeDasharray="3 3" label={`Meta: ${goals.treinamentos}%`} />
              <Line
                type="monotone"
                dataKey="taxa"
                stroke={getBarColorForValue(
                  metrics.trainings.total > 0 ? (metrics.trainings.completed / metrics.trainings.total) * 100 : 0,
                  goals.treinamentos,
                  true
                )}
                strokeWidth={3}
                name="Taxa de Conclusão"
                dot={{
                  fill: getBarColorForValue(
                    metrics.trainings.total > 0 ? (metrics.trainings.completed / metrics.trainings.total) * 100 : 0,
                    goals.treinamentos,
                    true
                  ),
                  r: 5
                }}
                activeDot={{ r: 7 }}
              />
            </LineChart>
          </ResponsiveContainer>
          <div className="mt-4 flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-blue-600" />
              <span className="text-sm font-medium text-gray-700">Meta: {goals.treinamentos}%</span>
            </div>
            <div className="flex items-center gap-2">
              {metrics.trainings.total > 0 && (metrics.trainings.completed / metrics.trainings.total) * 100 >= goals.treinamentos ? (
                <>
                  <TrendingUp className="w-5 h-5 text-green-600" />
                  <span className="text-sm font-semibold text-green-600">
                    Acima da meta
                  </span>
                </>
              ) : (
                <>
                  <TrendingDown className="w-5 h-5 text-amber-600" />
                  <span className="text-sm font-semibold text-amber-600">
                    {metrics.trainings.total > 0
                      ? `Abaixo da meta (${(goals.treinamentos - (metrics.trainings.completed / metrics.trainings.total) * 100).toFixed(1)}% para alcançar)`
                      : 'Sem dados'
                    }
                  </span>
                </>
              )}
            </div>
          </div>
        </MRSCard>

        <MRSCard title="EPIs em Boas Condições (%)" icon={HardHat}>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={[
              { mes: 'Jun', taxa: 92, meta: goals.epis },
              { mes: 'Jul', taxa: 94, meta: goals.epis },
              { mes: 'Ago', taxa: 96, meta: goals.epis },
              { mes: 'Set', taxa: 97, meta: goals.epis },
              { mes: 'Out', taxa: metrics.epis.total > 0 ? (metrics.epis.delivered / metrics.epis.total) * 100 : 0, meta: goals.epis }
            ]}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="mes" stroke="#6b7280" />
              <YAxis stroke="#6b7280" domain={[0, 100]} />
              <Tooltip
                contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                formatter={(value: number) => [`${value.toFixed(1)}%`, '']}
              />
              <Legend />
              <ReferenceLine y={goals.epis} stroke="#dc2626" strokeDasharray="3 3" label={`Meta: ${goals.epis}%`} />
              <Line
                type="monotone"
                dataKey="taxa"
                stroke={getBarColorForValue(
                  metrics.epis.total > 0 ? (metrics.epis.delivered / metrics.epis.total) * 100 : 0,
                  goals.epis,
                  true
                )}
                strokeWidth={3}
                name="Taxa OK"
                dot={{
                  fill: getBarColorForValue(
                    metrics.epis.total > 0 ? (metrics.epis.delivered / metrics.epis.total) * 100 : 0,
                    goals.epis,
                    true
                  ),
                  r: 5
                }}
                activeDot={{ r: 7 }}
              />
            </LineChart>
          </ResponsiveContainer>
          <div className="mt-4 flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-blue-600" />
              <span className="text-sm font-medium text-gray-700">Meta: {goals.epis}%</span>
            </div>
            <div className="flex items-center gap-2">
              {metrics.epis.total > 0 && (metrics.epis.delivered / metrics.epis.total) * 100 >= goals.epis ? (
                <>
                  <TrendingUp className="w-5 h-5 text-green-600" />
                  <span className="text-sm font-semibold text-green-600">
                    Acima da meta
                  </span>
                </>
              ) : (
                <>
                  <TrendingDown className="w-5 h-5 text-red-600" />
                  <span className="text-sm font-semibold text-red-600">
                    {metrics.epis.total > 0
                      ? `Abaixo da meta (${(goals.epis - (metrics.epis.delivered / metrics.epis.total) * 100).toFixed(1)}% para alcançar)`
                      : 'Sem dados'
                    }
                  </span>
                </>
              )}
            </div>
          </div>
        </MRSCard>
      </div>
    </div>
  );
}
