import { useState, useEffect } from 'react';
import { Users, UserX, Clock, Calendar, Briefcase, TrendingUp, Download, LayoutDashboard, Camera } from 'lucide-react';
import { motion } from 'framer-motion';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, Area, AreaChart, Label } from 'recharts';
import MRSCard from './MRSCard';
import MRSStatCard from './MRSStatCard';
import PeriodFilter from './PeriodFilter';
import { supabase } from '../../lib/supabase';
import { formatNumber, formatPercent } from '../../lib/format';
import { calculateDateRange, getPeriodLabel } from '../../lib/dateUtils';
import { useAutoRecalculate } from '../../lib/useAutoRecalculate';
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
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('all');
  const [selectedEmployee, setSelectedEmployee] = useState('all');
  const [employeesList, setEmployeesList] = useState<{ id: string; name: string }[]>([]);

  useAutoRecalculate(true, 10000);

  useEffect(() => {
    loadDashboardData();
  }, [selectedPeriod]);

  useEffect(() => {
    loadDashboardData();
  }, [selectedEmployee]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const { data: allEmployees } = await supabase.from('employees').select('id, name').eq('active', true).order('name');
      if (allEmployees) {
        setEmployeesList(allEmployees);
      }
 
      let employeesQuery = supabase.from('employees').select('*').eq('active', true);
      if (selectedEmployee !== 'all') {
        employeesQuery = employeesQuery.eq('id', selectedEmployee);
      }
      const { data: employees } = await employeesQuery;

      const { startDate, endDate } = calculateDateRange(selectedPeriod);
 
      let scoresQuery = supabase
        .from('employee_scores')
        .select(`
          employee_id,
          raw_value,
          criterion_id,
          period,
          evaluation_criteria (
            name,
            direction
          )
        `);
 
      if (selectedPeriod !== 'all') {
        scoresQuery = scoresQuery.gte('period', startDate).lte('period', endDate);
      }

      if (selectedEmployee !== 'all') {
        scoresQuery = scoresQuery.in('employee_id', [selectedEmployee]);
      }

      const { data: scores } = await scoresQuery;

      const totalEmployees = employees?.length || 0;
      const activeEmployees = totalEmployees;
      const departments = new Set(employees?.map(e => e.department));

      // Calculate department distribution
      const deptCounts = new Map<string, number>();
      employees?.forEach(emp => {
        deptCounts.set(emp.department, (deptCounts.get(emp.department) || 0) + 1);
      });
      const deptData = Array.from(deptCounts.entries())
        .map(([department, count]) => ({ department, count }))
        .sort((a, b) => b.count - a.count);
      setDepartmentData(deptData);

      const assiduityScores = scores?.filter(s => s.evaluation_criteria?.name === 'Assiduidade') || [];
      const avgAssiduity = assiduityScores.length > 0
        ? assiduityScores.reduce((sum, s) => sum + parseFloat(s.raw_value), 0) / assiduityScores.length
        : 0;

      const absences = Math.round((100 - avgAssiduity) * totalEmployees / 100);

      const punctualityScores = scores?.filter(s => s.evaluation_criteria?.name === 'Pontualidade') || [];
      const avgPunctuality = punctualityScores.length > 0
        ? punctualityScores.reduce((sum, s) => sum + parseFloat(s.raw_value), 0) / punctualityScores.length
        : 0;
      const delays = Math.round(avgPunctuality);

      const hoursScores = scores?.filter(s => s.evaluation_criteria?.name === 'Horas Trabalhadas') || [];
      const averageHours = hoursScores.length > 0
        ? hoursScores.reduce((sum, s) => sum + parseFloat(s.raw_value), 0) / hoursScores.length
        : 0;

      const absenteeismRate = 100 - avgAssiduity;

      setStats({
        totalEmployees,
        absences,
        delays,
        averageHours,
        activeEmployees,
        departmentCount: departments.size,
        absenteeismRate,
      });

      // Load chart data: show employees for short periods, months for longer periods
      const monthlyChartData: MonthlyData[] = [];

      // Always show individual employees for all periods
      const employeesWithScores = employees || [];

      for (const emp of employeesWithScores) {
        const empScores = scores?.filter(s => s.employee_id === emp.id) || [];

        const faltasScores = empScores.filter(s => s.evaluation_criteria?.name === 'Assiduidade');
        const avgAssiduity = faltasScores.length > 0
          ? faltasScores.reduce((sum, s) => sum + parseFloat(s.raw_value), 0) / faltasScores.length
          : 100;
        const faltas = Math.max(0, Math.round((100 - avgAssiduity) / 5));

        const atrasosScores = empScores.filter(s => s.evaluation_criteria?.name === 'Pontualidade');
        const atrasos = atrasosScores.length > 0
          ? Math.max(0, Math.round(atrasosScores.reduce((sum, s) => sum + parseFloat(s.raw_value), 0)))
          : 0;

        monthlyChartData.push({
          month: emp.name.split(' ')[0],
          faltas,
          atrasos,
        });
      }

      // Ordenar colaboradores pela soma de faltas e atrasos (maior para menor)
      monthlyChartData.sort((a, b) => (b.faltas + b.atrasos) - (a.faltas + a.atrasos));

      setMonthlyData(monthlyChartData);

      // Carregar dados para o gráfico de evolução mensal (diário ou mensal, dependendo do período)
      const evolutionData: MonthlyEvolutionData[] = [];
      const periodInDays = ['all', '365', '180'].includes(selectedPeriod) ? 365 : parseInt(selectedPeriod, 10) || 30;
      const showMonthly = periodInDays > 90;

      if (showMonthly) {
        // Agrupar por mês para períodos longos
        const monthsToFetch = periodInDays <= 180 ? 6 : 12;
        const firstMonth = new Date();
        firstMonth.setMonth(firstMonth.getMonth() - (monthsToFetch - 1));

        for (let i = 0; i < monthsToFetch; i++) {
          const date = new Date(firstMonth.getFullYear(), firstMonth.getMonth() + i, 1);
          const monthLabel = date.toLocaleString('pt-BR', { month: 'short' });
          const monthStart = new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0];
          const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split('T')[0];

          const { data: monthScores } = await supabase
            .from('employee_scores')
            .select('raw_value, evaluation_criteria(name)')
            .gte('period', monthStart)
            .lte('period', monthEnd);

          const monthAssiduityScores = monthScores?.filter(s => s.evaluation_criteria?.name === 'Assiduidade') || [];
          const monthAvgAssiduity = monthAssiduityScores.length > 0 ? monthAssiduityScores.reduce((sum, s) => sum + parseFloat(s.raw_value), 0) / monthAssiduityScores.length : 100;
          const totalFaltas = Math.max(0, Math.round(((100 - monthAvgAssiduity) / 100) * totalEmployees));

          const monthPunctualityScores = monthScores?.filter(s => s.evaluation_criteria?.name === 'Pontualidade') || [];
          const totalAtrasos = monthPunctualityScores.reduce((sum, s) => sum + parseFloat(s.raw_value), 0);

          evolutionData.push({ month: monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1), Faltas: totalFaltas, Atrasos: Math.round(totalAtrasos) });
        }
      } else {
        // Agrupar por dia para períodos curtos
        const { data: periodScores } = await supabase
          .from('employee_scores')
          .select('raw_value, evaluation_criteria(name)')
          .gte('period', startDate)
          .lte('period', endDate);

        const dailyData = new Map<string, { faltas: number; atrasos: number }>();

        periodScores?.forEach(score => {
          // Esta parte precisaria de uma lógica mais complexa para agrupar por dia,
          // por simplicidade, vamos manter a lógica mensal por enquanto.
          // A implementação diária será adicionada em uma próxima etapa.
        });
        // Por enquanto, vamos replicar a lógica mensal para períodos curtos para não quebrar.
        // O ideal seria agrupar por dia.
        evolutionData.push({ month: getPeriodLabel(selectedPeriod), Faltas: stats.absences, Atrasos: stats.delays });
      }
      setMonthlyEvolutionData(evolutionData);

    } catch (error) {
      console.error('Erro ao carregar dashboard:', error);
      setMonthlyData([]);
      setDepartmentData([]);
    } finally {
      setLoading(false);
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
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-[#002b55] mx-auto"></div>
          <p className="text-gray-600 mt-4 font-medium">Carregando dados...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-[#002b55] flex items-center gap-1.5">
            <LayoutDashboard className="w-4 h-4 text-[#ffcc00]" />
            Dashboard RH
          </h1>
          <p className="text-gray-600 mt-1 text-base">Indicadores e métricas de gestão de pessoas</p>
        </div>
        <div className="flex flex-col md:flex-row items-start md:items-center gap-1.5">
          <PeriodFilter
            selectedPeriod={selectedPeriod}
            onPeriodChange={setSelectedPeriod}
          />
          <div className="flex items-center gap-2 text-gray-700">
            <Users className="w-5 h-5 text-[#002b55]" />
            <select
              value={selectedEmployee}
              onChange={(e) => setSelectedEmployee(e.target.value)}
              className="px-4 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#002b55] focus:border-[#002b55] bg-white text-gray-700 font-medium shadow-sm hover:border-[#002b55] transition-all cursor-pointer"
            >
              <option value="all">Todos os Colaboradores</option>
              {employeesList.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.name}</option>
              ))}
            </select>
          </div>
          <button
            onClick={handleScreenshot}
            className="px-4 py-2 bg-gradient-to-r from-[#ffcc00] to-[#ffd633] text-[#002b55] rounded-md hover:shadow-lg transition-all flex items-center gap-1.5 font-semibold text-base"
          >
            <Camera className="w-3 h-3" />
            Capturar
          </button>
          <button
            onClick={handleExportPDF}
            className="px-4 py-2 bg-gradient-to-r from-[#002b55] to-[#003d73] text-white font-semibold rounded-md hover:shadow-lg transition-all flex items-center gap-1.5 text-base"
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
          colorClass="from-[#002b55] to-[#003d73]"
        />
        <MRSStatCard
          title="Faltas (30 dias)"
          value={stats.absences}
          icon={<UserX className="w-2 h-4" />}
          trend={-5.2}
          colorClass="from-red-600 to-red-700"
        />
        <MRSStatCard
          title="Atrasos (30 dias)"
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
                const colors = ['bg-[#002b55]', 'bg-blue-600', 'bg-[#ffcc00]', 'bg-emerald-600', 'bg-purple-600', 'bg-pink-600'];
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
            <IndicatorRow label="Total de Colaboradores" value={stats.totalEmployees.toString()} color="text-[#002b55]" size="lg" />
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
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={monthlyEvolutionData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line
              type="monotone"
              dataKey="Faltas"
              stroke="#ef4444"
              strokeWidth={2}
              dot={{ r: 5 }}
            />
            <Line
              type="monotone"
              dataKey="Atrasos"
              stroke="#f97316"
              strokeWidth={2}
              dot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </MRSCard>

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
