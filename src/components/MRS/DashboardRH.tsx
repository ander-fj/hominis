import { useState, useEffect } from 'react';
import { Users, UserX, Clock, Calendar, Briefcase, TrendingUp, Download, LayoutDashboard, Camera, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList } from 'recharts';
import MRSCard from './MRSCard';
import MRSStatCard from './MRSStatCard';
import PeriodFilter from './PeriodFilter';
import { formatNumber, formatPercent } from '../../lib/format';
import { calculateDateRange, getPeriodLabel } from '../../lib/dateUtils';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface DashboardStats {
  totalEmployees: number;
  absences: number;
  delays: number;
  averageHours: number;
  activeEmployees: number;
  departmentCount: number;
  absenteeismRate: number;
}

interface MonthlyData {
  month: string;
  faltas: number;
  atrasos: number;
}

interface MonthlyEvolutionData {
  month: string;
  rawDate: string;
  Faltas: number;
  Atrasos: number;
}

interface DepartmentData {
  department: string;
  count: number;
}

export default function DashboardRH() {
  const [stats, setStats] = useState<DashboardStats>({
    totalEmployees: 0,
    absences: 0,
    delays: 0,
    averageHours: 0,
    activeEmployees: 0,
    departmentCount: 0,
    absenteeismRate: 0,
  });
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [monthlyEvolutionData, setMonthlyEvolutionData] = useState<MonthlyEvolutionData[]>([]);
  const [departmentData, setDepartmentData] = useState<DepartmentData[]>([]);
  const [allScores, setAllScores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('all');
  const [selectedEmployee, setSelectedEmployee] = useState('all');
  const [employeesList, setEmployeesList] = useState<{ id: string; name: string }[]>([]);
  const [availablePeriods, setAvailablePeriods] = useState<{ value: string; label: string }[]>([]);

  const [showDailyModal, setShowDailyModal] = useState(false);
  const [dailyData, setDailyData] = useState<any[]>([]);
  const [selectedMonthLabel, setSelectedMonthLabel] = useState('');

  useEffect(() => {
    loadDashboardData();
  }, [selectedPeriod, selectedEmployee]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      // Carregar períodos disponíveis
      const periodsQuery = query(collection(db, 'employee_rankings'), orderBy('period', 'desc'));
      const periodsSnapshot = await getDocs(periodsQuery);
      const periods = [...new Set(periodsSnapshot.docs.map(doc => doc.data().period as string))].filter(p => p !== 'consolidated');
      const periodOptions = periods.map(p => ({
        value: p,
        label: new Date(p + 'T00:00:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
      }));
      setAvailablePeriods(periodOptions);

      // Carregar lista de colaboradores para o filtro
      const allEmployeesQuery = query(collection(db, 'employees'), where('active', '==', true));
      const allEmployeesSnapshot = await getDocs(allEmployeesQuery);
      const allEmployeesData = allEmployeesSnapshot.docs
        .map(doc => ({ id: doc.id, name: doc.data().name as string }))
        .sort((a, b) => a.name.localeCompare(b.name));
      setEmployeesList(allEmployeesData);

      // Filtrar colaboradores selecionados
      let employeesQuery = query(collection(db, 'employees'), where('active', '==', true));
      if (selectedEmployee !== 'all') {
        employeesQuery = query(employeesQuery, where('__name__', '==', selectedEmployee));
      }
      const employeesSnapshot = await getDocs(employeesQuery);
      const employees = employeesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Carregar pontuações (scores)
      const { startDate, endDate } = calculateDateRange(selectedPeriod);
      let scoresQuery = collection(db, 'employee_scores');
      
      let finalScoresQuery;
      if (selectedPeriod !== 'all') {
        finalScoresQuery = query(scoresQuery, where('period', '>=', startDate), where('period', '<=', endDate));
      } else if (selectedEmployee !== 'all') {
        finalScoresQuery = query(scoresQuery, where('employee_id', '==', selectedEmployee));
      } else {
        finalScoresQuery = query(scoresQuery);
      }
      
      const scoresSnapshot = await getDocs(finalScoresQuery);
      // Simula a junção que o Supabase fazia, adicionando o nome do critério ao score.
      // Isso pode ser otimizado no futuro.
      const criteriaSnapshot = await getDocs(collection(db, 'evaluation_criteria'));
      const criteriaMap = new Map(criteriaSnapshot.docs.map(doc => [doc.id, doc.data()]));

      let scores = scoresSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          evaluation_criteria: {
            name: criteriaMap.get(data.criterion_id)?.name || 'Desconhecido'
          }
        };
      });

      // Filtragem em memória para casos combinados (evita índice composto)
      if (selectedPeriod !== 'all' && selectedEmployee !== 'all') {
        scores = scores.filter(s => s.employee_id === selectedEmployee);
      }

      // Armazenar todos os scores para uso no drill-down diário
      setAllScores(scores);

      // --- Início dos Cálculos (lógica mantida do original) ---
      const totalEmployees = employees.length;
      const departments = new Set(employees.map(e => e.department));

      const deptCounts = new Map<string, number>();
      employees.forEach(emp => {
        deptCounts.set(emp.department, (deptCounts.get(emp.department) || 0) + 1);
      });
      const deptData = Array.from(deptCounts.entries())
        .map(([department, count]) => ({ department, count }))
        .sort((a, b) => b.count - a.count);
      setDepartmentData(deptData);

      let totalAbsencesOverall = 0;
      const allAssiduityScores = scores.filter(s => s.evaluation_criteria?.name === 'Assiduidade');
      allAssiduityScores.forEach(s => {
        totalAbsencesOverall += (100 - parseFloat(s.raw_value)) / 5;
      });

      let totalDelaysOverall = 0;
      const allPunctualityScores = scores.filter(s => s.evaluation_criteria?.name === 'Pontualidade');
      allPunctualityScores.forEach(s => {
        totalDelaysOverall += parseFloat(s.raw_value);
      });

      const avgAssiduityOverall = allAssiduityScores.length > 0
        ? allAssiduityScores.reduce((sum, s) => sum + parseFloat(s.raw_value), 0) / allAssiduityScores.length
        : 0;

      const hoursScores = scores.filter(s => s.evaluation_criteria?.name === 'Horas Trabalhadas');
      const averageHours = hoursScores.length > 0
        ? hoursScores.reduce((sum, s) => sum + parseFloat(s.raw_value), 0) / hoursScores.length
        : 0;

      setStats({
        totalEmployees,
        activeEmployees: totalEmployees,
        absences: Math.round(totalAbsencesOverall),
        delays: Math.round(totalDelaysOverall),
        averageHours,
        departmentCount: departments.size,
        absenteeismRate: 100 - avgAssiduityOverall,
      });

      // Dados para gráficos
      const monthlyChartData: MonthlyData[] = employees.map(emp => {
        const empScores = scores.filter(s => s.employee_id === emp.id);
        const faltas = empScores.filter(s => s.evaluation_criteria?.name === 'Assiduidade').reduce((acc, s) => acc + (100 - parseFloat(s.raw_value)) / 5, 0);
        const atrasos = empScores.filter(s => s.evaluation_criteria?.name === 'Pontualidade').reduce((acc, s) => acc + parseFloat(s.raw_value), 0);
        return { month: emp.name.split(' ')[0], faltas: Math.round(faltas), atrasos: Math.round(atrasos) };
      }).sort((a, b) => (b.faltas + b.atrasos) - (a.faltas + a.atrasos));

      setMonthlyData(monthlyChartData);
      
      // Agrupamento por período para o gráfico de evolução
      const evolutionMap = new Map<string, { Faltas: number; Atrasos: number }>();

      scores.forEach(score => {
        if (!score.period) return;
        // Agrupar por Mês (YYYY-MM) para o gráfico principal
        const monthKey = score.period.substring(0, 7);

        if (!evolutionMap.has(monthKey)) {
          evolutionMap.set(monthKey, { Faltas: 0, Atrasos: 0 });
        }
        
        const entry = evolutionMap.get(monthKey)!;
        const criteriaName = score.evaluation_criteria?.name;

        if (criteriaName === 'Assiduidade') {
           const val = parseFloat(score.raw_value);
           if (!isNaN(val)) {
             entry.Faltas += (100 - val) / 5;
           }
        } else if (criteriaName === 'Pontualidade') {
           const val = parseFloat(score.raw_value);
           if (!isNaN(val)) {
             entry.Atrasos += val;
           }
        }
      });

      const evolutionData = Array.from(evolutionMap.entries())
        .map(([period, data]) => {
           const [year, month] = period.split('-');
           const date = new Date(parseInt(year), parseInt(month) - 1, 1);
           const monthName = date.toLocaleDateString('pt-BR', { month: 'short' });
           const formattedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);
           
           return {
             month: `${formattedMonth}/${year.slice(2)}`,
             rawDate: `${period}-01`,
             Faltas: Math.round(data.Faltas),
             Atrasos: Math.round(data.Atrasos)
           };
        })
        .sort((a, b) => a.rawDate.localeCompare(b.rawDate));

      setMonthlyEvolutionData(evolutionData);

    } catch (error) {
      console.error("Erro ao carregar dados do dashboard com Firebase:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleChartClick = (data: any) => {
    if (data && data.activePayload && data.activePayload.length > 0) {
      const payload = data.activePayload[0].payload;
      const monthKey = payload.rawDate.substring(0, 7); // YYYY-MM
      const [yearStr, monthStr] = monthKey.split('-');
      const year = parseInt(yearStr);
      const month = parseInt(monthStr);

      // Determinar quantos dias tem no mês selecionado
      const daysInMonth = new Date(year, month, 0).getDate();
      
      const dailyMap = new Map<string, { Faltas: number; Atrasos: number }>();
      
      // Inicializar todos os dias do mês com 0 para garantir o eixo X completo
      for (let i = 1; i <= daysInMonth; i++) {
          const dayStr = String(i).padStart(2, '0');
          const dateKey = `${monthKey}-${dayStr}`;
          dailyMap.set(dateKey, { Faltas: 0, Atrasos: 0 });
      }
      
      // Filtrar scores que pertencem ao mês selecionado
      const monthScores = allScores.filter(s => s.period && s.period.startsWith(monthKey));
      
      monthScores.forEach(score => {
         // Se a data for YYYY-MM, assume dia 01. Se for YYYY-MM-DD, usa a data correta.
         let dayKey = score.period;
         if (dayKey.length === 7) dayKey += '-01';

         // Só processa se o dia estiver dentro do mapa do mês (segurança)
         if (dailyMap.has(dayKey)) {
             const entry = dailyMap.get(dayKey)!;
             const criteriaName = score.evaluation_criteria?.name;

             if (criteriaName === 'Assiduidade') {
               const val = parseFloat(score.raw_value);
               if (!isNaN(val)) {
                 entry.Faltas += (100 - val) / 5;
               }
            } else if (criteriaName === 'Pontualidade') {
               const val = parseFloat(score.raw_value);
               if (!isNaN(val)) {
                 entry.Atrasos += val;
               }
            }
         }
      });

      const chartData = Array.from(dailyMap.entries())
        .map(([date, data]) => {
            const parts = date.split('-');
            const d = parts[2];
            const m = parts[1];
            
            return {
                day: `${d}/${m}`,
                fullDate: date,
                Faltas: Math.round(data.Faltas),
                Atrasos: Math.round(data.Atrasos)
            };
        })
        .sort((a, b) => a.fullDate.localeCompare(b.fullDate));

      setDailyData(chartData);
      setSelectedMonthLabel(payload.month);
      setShowDailyModal(true);
    }
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
      link.download = `dashboard-rh-${new Date().toISOString().split('T')[0]}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error('Erro ao capturar tela:', error);
      alert('Erro ao capturar tela. Tente novamente.');
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

      pdf.save('Dashboard-RH.pdf');
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      alert('Erro ao gerar PDF. Tente novamente.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-[#912325] mx-auto"></div>
          <p className="text-gray-600 mt-4 font-medium">Carregando dados...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-[#912325] flex items-center gap-3">
            <LayoutDashboard className="w-4 h-4 text-[#912325]" />
            Painel RH
          </h1>
          <p className="text-gray-600 mt-1">Indicadores e métricas de gestão de pessoas</p>
        </div>
        <div className="flex flex-col md:flex-row items-start md:items-center gap-1.5">
          <PeriodFilter
            selectedPeriod={selectedPeriod}
            onPeriodChange={setSelectedPeriod}
          />
          <div className="flex items-center gap-2 text-gray-700">
            <Users className="w-5 h-5 text-[#912325]" />
            <select
              value={selectedEmployee}
              onChange={(e) => setSelectedEmployee(e.target.value)}
              className="px-4 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#912325] focus:border-[#912325] bg-white text-gray-700 font-medium shadow-sm hover:border-[#912325] transition-all cursor-pointer"
            >
              <option value="all">Todos os Colaboradores</option>
              {employeesList.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.name}</option>
              ))}
            </select>
          </div>
          <button
            onClick={handleScreenshot}
            className="px-4 py-2 bg-white border-2 border-gray-300 text-gray-700 rounded-md hover:shadow-lg hover:bg-gray-50 transition-all flex items-center gap-1.5 font-semibold text-base"
          >
            <Camera className="w-3 h-3" />
            Capturar
          </button>
          <button
            onClick={handleExportPDF}
            className="px-4 py-2 bg-gradient-to-r from-[#912325] to-[#701a1c] text-white font-semibold rounded-md hover:shadow-lg transition-all flex items-center gap-1.5 text-base"
          >
            <Download className="w-3 h-3" />
            PDF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-1 lg:grid-cols-4 gap-1">
        <MRSStatCard
          title="Colaboradores Ativos"
          value={stats.activeEmployees}
          icon={<Users className="w-2 h-4" />}
          trend={2.5}
          colorClass="from-[#912325] to-[#701a1c]"
        />
        <MRSStatCard
          title="Faltas"
          value={stats.absences}
          icon={<UserX className="w-2 h-4" />}
          trend={-5.2}
          colorClass="from-red-600 to-red-700"
        />
        <MRSStatCard
          title="Atrasos"
          value={stats.delays}
          icon={<Clock className="w-2 h-4" />}
          trend={-3.1}
          colorClass="from-amber-600 to-amber-700"
        />
        <MRSStatCard
          title="Horas Médias/Dia"
          value={formatNumber(stats.averageHours, 1)}
          icon={<Calendar className="w-2 h-4" />}
          trend={1.2}
          colorClass="from-emerald-600 to-emerald-700"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-8 gap-2.5">
        <MRSCard title="Distribuição por Departamento" icon={Briefcase} className="lg:col-span-2">
          {departmentData.length === 0 ? (
            <div className="h-20 flex items-center justify-center">
              <div className="text-center">
                <Briefcase className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500 font-medium text-base">Nenhum departamento cadastrado</p>
                <p className="text-sm text-gray-400 mt-1">Adicione colaboradores primeiro</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {departmentData.map((dept, index) => {
                const colors = ['bg-[#912325]', 'bg-red-600', 'bg-[#f97316]', 'bg-orange-500', 'bg-gray-600', 'bg-gray-500'];
                return (
                  <DepartmentBar
                    key={dept.department}
                    department={dept.department}
                    count={dept.count}
                    total={stats.totalEmployees}
                    color={colors[index % colors.length]}
                  />
                );
              })}
            </div>
          )}
        </MRSCard>
        <MRSCard title="Indicadores Consolidados" icon={TrendingUp} className="lg:col-span-2">
          <div className="space-y-1.5">
            <IndicatorRow label="Total de Colaboradores" value={stats.totalEmployees.toString()} color="text-[#912325]" size="lg" />
            <IndicatorRow label="Departamentos" value={stats.departmentCount.toString()} color="text-blue-600" size="lg" />
            <IndicatorRow label="Taxa de Absenteísmo" value={formatPercent(stats.absenteeismRate)} color="text-amber-600" size="lg" />
            <IndicatorRow label="Média de Horas/Dia" value={`${formatNumber(stats.averageHours, 1)}h`} color="text-emerald-600" size="lg" />
          </div>
        </MRSCard>

        <MRSCard title="Evolução Mensal - Faltas e Atrasos" collapsible defaultOpen className="lg:col-span-4">
          {monthlyData.length === 0 ? (
            <div className="h-16 flex items-center justify-center">
              <div className="text-center">
                <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500 font-medium text-sm">Nenhum dado histórico disponível</p>
                <p className="text-xs text-gray-400 mt-1">Adicione colaboradores e gere dados históricos</p>
              </div>
            </div>
          ) : (
              <>
              <div className="w-full pb-1 overflow-x-auto">
                <div className="h-52 flex items-end gap-2 px-2" style={{ minWidth: `${monthlyData.length * 4}rem` }}>
                  {monthlyData.map((item, index) => {
                    const maxValue = Math.max(...monthlyData.map(d => Math.max(d.faltas, d.atrasos)), 1);
                    const faltasHeight = maxValue > 0 ? Math.max(5, (item.faltas / maxValue) * 130) : 0;
                    const atrasosHeight = maxValue > 0 ? Math.max(5, (item.atrasos / maxValue) * 130) : 0;

                    return (
                      <div key={index} className="flex flex-col items-center gap-1 flex-1 min-w-[3rem]">
                        <div className="w-full flex gap-1 items-end justify-center" style={{ height: '100px' }}>
                          <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: item.faltas > 0 ? `${faltasHeight}%` : '0%' }}
                            transition={{ delay: index * 0.05, duration: 0.5 }}
                            className="flex-1 max-w-[6px] bg-gradient-to-t from-red-600 to-red-400 rounded-t hover:opacity-80 transition-opacity cursor-pointer relative group"
                            title={`Faltas: ${item.faltas}`}
                          >
                            {item.faltas > 0 && (
                              <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-1.5 py-0.5 rounded opacity-100 transition-opacity whitespace-nowrap z-10">
                                {item.faltas}
                              </div>
                            )}
                          </motion.div>
                          <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: item.atrasos > 0 ? `${atrasosHeight}%` : '0%' }}
                            transition={{ delay: index * 0.05 + 0.05, duration: 0.5 }}
                            className="flex-1 max-w-[6px] bg-gradient-to-t from-amber-600 to-amber-400 rounded-t hover:opacity-80 transition-opacity cursor-pointer relative group"
                            title={`Atrasos: ${item.atrasos}`}
                          >
                            {item.atrasos > 0 && (
                              <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-1.5 py-0.5 rounded opacity-100 transition-opacity whitespace-nowrap z-10">
                                {item.atrasos}
                              </div>
                            )}
                          </motion.div>
                        </div>
                        <span className="text-sm font-medium text-gray-600 truncate w-full text-center">{item.month}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="flex items-center justify-center gap-4 mt-2.5 pt-2 border-t border-gray-200">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 bg-gradient-to-r from-red-600 to-red-400 rounded"></div>
                  <span className="text-sm text-gray-600">Faltas</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2.5 h-2.5 bg-gradient-to-r from-amber-600 to-amber-400 rounded"></div>
                  <span className="text-sm text-gray-600">Atrasos</span>
                </div>
              </div>
            </>
          ) }
        </MRSCard>
      </div>

      <MRSCard title={`Evolução de Faltas e Atrasos (${getPeriodLabel(selectedPeriod)})`} icon={TrendingUp} collapsible defaultOpen>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart 
            data={monthlyEvolutionData}
            onClick={handleChartClick}
            margin={{ top: 5, right: 20, bottom: 5, left: 0 }}
            style={{ cursor: 'pointer' }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" allowDuplicatedCategory={false} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line
              type="monotone"
              dataKey="Faltas"
              stroke="#ef4444"
              strokeWidth={2}
              dot={{ r: 6 }}
              activeDot={{ r: 8 }}
            >
              <LabelList dataKey="Faltas" position="top" offset={15} style={{ fill: '#ef4444', fontSize: 16, fontWeight: 'bold' }} formatter={(value: number) => value > 0 ? value : ''} />
            </Line>
            <Line
              type="monotone"
              dataKey="Atrasos"
              stroke="#f97316"
              strokeWidth={2}
              dot={{ r: 6 }}
              activeDot={{ r: 8 }}
            >
              <LabelList dataKey="Atrasos" position="top" offset={15} style={{ fill: '#f97316', fontSize: 16, fontWeight: 'bold' }} formatter={(value: number) => value > 0 ? value : ''} />
            </Line>
          </LineChart>
        </ResponsiveContainer>
      </MRSCard>

      {showDailyModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-8xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-[#912325]">
                Detalhamento Diário - {selectedMonthLabel}
              </h2>
              <button
                onClick={() => setShowDailyModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-6 h-6 text-gray-500" />
              </button>
            </div>
            <div className="p-6 h-[400px] w-full">
              {dailyData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" />
                    <YAxis />
                    <Tooltip cursor={{ fill: 'rgba(0, 0, 0, 0.05)' }} />
                    <Legend />
                    <Bar dataKey="Faltas" fill="#ef4444" name="Faltas" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Atrasos" fill="#f97316" name="Atrasos" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500">Nenhum dado diário disponível para este mês.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DepartmentBar({ department, count, total, color }: { department: string; count: number; total: number; color: string }) {
  const percentage = total > 0 ? (count / total) * 100 : 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-base font-medium text-gray-800">{department}</span>
        <span className="text-base font-semibold text-gray-700">{count} colab.</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className={`h-full ${color} rounded-full`}
        />
      </div>
    </div>
  );
}

function IndicatorRow({ label, value, color, size = 'base' }: { label: string; value: string; color: string; size?: 'base' | 'lg' }) {
  return (
    <div className={`flex items-baseline justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors`}>
      <span className={`font-medium text-gray-700 ${size === 'lg' ? 'text-base' : 'text-sm'}`}>{label}</span>
      <span className={`font-bold ${color} ${size === 'lg' ? 'text-xl' : 'text-lg'}`}>{value}</span>
    </div>
  );
}
