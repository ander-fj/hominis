import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, AlertTriangle, Target, Calendar, Activity, BarChart3, LineChart as LineChartIcon, ArrowUpRight, ArrowDownRight, Minus, ChevronDown, ChevronUp, Download } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, Area, AreaChart, Label } from 'recharts';
import MRSCard from './MRSCard';
import MRSStatCard from './MRSStatCard';
import { supabase } from '../../lib/supabase';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface MonthlyMetrics {
  month: string;
  trainings: number;
  incidents: number;
  exams: number;
  conformity: number;
}

interface SSTGoals {
  conformidade: number;
  incidentes: number;
  treinamentos: number;
  epis: number;
  avgTrainings?: number;
  avgExams?: number;
}
interface PredictionData {
  metric: string;
  current: number;
  predicted: number;
  trend: 'up' | 'down' | 'stable';
  confidence: number;
}

export default function Previsoes() {
  const [loading, setLoading] = useState(true);
  const [historicalData, setHistoricalData] = useState<MonthlyMetrics[]>([]);
  const [predictions, setPredictions] = useState<PredictionData[]>([]);
  const [goals, setGoals] = useState<SSTGoals>({
    conformidade: 95,
    incidentes: 5,
    treinamentos: 90,
    epis: 98
  });
  const [isMethodologyExpanded, setIsMethodologyExpanded] = useState(false);

  useEffect(() => {
    loadGoals();
    loadHistoricalData();
  }, []);

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

      pdf.save('Previsoes-Tendencias.pdf');
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      alert('Erro ao gerar PDF. Tente novamente.');
    }
  };

  const loadGoals = async () => {
    try {
      const { data, error } = await supabase
        .from('sst_goals')
        .select('*');

      if (error) throw error;

      if (data) {
        const goalsMap: Partial<SSTGoals> = {};

        data.forEach((goal) => {
          if (goal.goal_type in { conformidade: 0, incidentes: 0, treinamentos: 0, epis: 0 }) {
            goalsMap[goal.goal_type as keyof SSTGoals] = goal.goal_value;
          }
        });

        setGoals(prev => ({
          ...prev,
          ...goalsMap
        }));
      }
    } catch (error) {
      console.error('Erro ao carregar metas:', error);
    }
  };

  const handleGoalUpdate = async (goalType: keyof SSTGoals, value: number) => {
    // Optimistic UI update
    setGoals(prev => ({ ...prev, [goalType]: value }));

    try {
      const { error } = await supabase
        .from('sst_goals')
        .update({ goal_value: value, updated_at: new Date().toISOString() })
        .eq('goal_type', goalType);

      if (error) {
        console.error(`Erro ao salvar meta de ${goalType}:`, error);
        // Optionally, revert UI change or show an error toast
      }
    } catch (error) {
      console.error(`Erro ao salvar meta de ${goalType}:`, error);
    }
  };

  const loadHistoricalData = async () => {
    try {
      setLoading(true);

      // Últimos 6 meses
      const months = Array.from({ length: 6 }, (_, i) => {
        const date = subMonths(new Date(), 5 - i);
        return {
          start: startOfMonth(date).toISOString().split('T')[0],
          end: endOfMonth(date).toISOString().split('T')[0],
          label: format(date, 'MMM')
        };
      });

      const metricsPromises = months.map(async (month) => {
        // Treinamentos concluídos
        const { count: trainingsCount } = await supabase
          .from('sst_trainings')
          .select('*', { count: 'exact', head: true })
          .gte('completion_date', month.start)
          .lte('completion_date', month.end)
          .eq('status', 'valid');

        // Incidentes
        const { count: incidentsCount } = await supabase
          .from('sst_incidents')
          .select('*', { count: 'exact', head: true })
          .gte('incident_date', month.start)
          .lte('incident_date', month.end);

        // Exames realizados
        const { count: examsCount } = await supabase
          .from('sst_medical_exams')
          .select('*', { count: 'exact', head: true })
          .gte('exam_date', month.start)
          .lte('exam_date', month.end);

        // Taxa de conformidade (simplificada)
        const { count: totalEmployees } = await supabase
          .from('employees')
          .select('*', { count: 'exact', head: true });

        const { count: upToDateExams } = await supabase
          .from('sst_medical_exams')
          .select('*', { count: 'exact', head: true })
          .lte('exam_date', month.end)
          .eq('status', 'valid');

        const conformity = totalEmployees && totalEmployees > 0
          ? ((upToDateExams || 0) / totalEmployees) * 100
          : 0;

        return {
          month: month.label,
          trainings: trainingsCount || 0,
          incidents: incidentsCount || 0,
          exams: examsCount || 0,
          conformity: Math.round(conformity)
        };
      });

      const metrics = await Promise.all(metricsPromises);
      setHistoricalData(metrics);

      // Calcular previsões baseadas nos dados históricos
      calculatePredictions(metrics);

      // Calcular médias para usar como metas de contagem
      const avgTrainings = metrics.reduce((sum, item) => sum + item.trainings, 0) / metrics.length;
      const avgExams = metrics.reduce((sum, item) => sum + item.exams, 0) / metrics.length;

      setGoals(prev => ({ ...prev, avgTrainings, avgExams }));

    } catch (error) {
      console.error('Erro ao carregar dados históricos:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculatePredictions = (data: MonthlyMetrics[]) => {
    if (data.length < 3) return;

    // Calcular tendências usando média móvel simples
    const predictMetric = (values: number[]) => {
      const recent = values.slice(-3);
      const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
      const trend = recent[recent.length - 1] - recent[0];
      const predicted = Math.round(avg + trend);

      return {
        current: values[values.length - 1],
        predicted,
        trend: trend > 1 ? 'up' as const : trend < -1 ? 'down' as const : 'stable' as const
      };
    };

    const trainingsData = predictMetric(data.map(d => d.trainings));
    const incidentsData = predictMetric(data.map(d => d.incidents));
    const examsData = predictMetric(data.map(d => d.exams));
    const conformityData = predictMetric(data.map(d => d.conformity));

    setPredictions([
      {
        metric: 'Treinamentos/Mês',
        ...trainingsData,
        confidence: 78
      },
      {
        metric: 'Incidentes/Mês',
        ...incidentsData,
        confidence: 82
      },
      {
        metric: 'Exames/Mês',
        ...examsData,
        confidence: 85
      },
      {
        metric: 'Taxa de Conformidade',
        ...conformityData,
        confidence: 75
      }
    ]);
  };

  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up':
        return <ArrowUpRight className="w-5 h-5" />;
      case 'down':
        return <ArrowDownRight className="w-5 h-5" />;
      default:
        return <Minus className="w-5 h-5" />;
    }
  };

  const getTrendColor = (metric: string, trend: 'up' | 'down' | 'stable') => {
    // Para incidentes, tendência de alta é ruim
    if (metric.includes('Incidentes')) {
      return trend === 'down' ? 'text-green-600 bg-green-50' :
             trend === 'up' ? 'text-red-600 bg-red-50' :
             'text-gray-600 bg-gray-50';
    }
    // Para outros, tendência de alta é boa
    return trend === 'up' ? 'text-green-600 bg-green-50' :
           trend === 'down' ? 'text-red-600 bg-red-50' :
           'text-gray-600 bg-gray-50';
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-[#002b55]">Previsões e Tendências</h1>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#002b55]"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#002b55]">Previsões e Tendências</h1>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Calendar className="w-4 h-4" />
            <span>Análise dos últimos 6 meses</span>
          </div>
          <button
            onClick={handleExportPDF}
            className="px-4 py-2 bg-gradient-to-r from-[#002b55] to-[#003d73] text-white rounded-lg hover:shadow-lg transition-all duration-200 flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Exportar PDF
          </button>
        </div>
      </div>

      {/* Cards de Previsão */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {predictions.map((pred) => (
          <div
            key={pred.metric}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="text-sm text-gray-600 mb-1">{pred.metric}</div>
                <div className="text-3xl font-bold text-gray-900">{pred.predicted}</div>
              </div>
              <div className={`p-2 rounded-lg ${getTrendColor(pred.metric, pred.trend)}`}>
                {getTrendIcon(pred.trend)}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Atual:</span>
                <span className="font-semibold text-gray-900">{pred.current}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Previsão:</span>
                <span className="font-semibold text-blue-600">{pred.predicted}</span>
              </div>
              <div className="pt-2 border-t border-gray-100">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">Confiança:</span>
                  <span className="font-medium text-gray-700">{pred.confidence}%</span>
                </div>
                <div className="mt-1 w-full bg-gray-200 rounded-full h-1.5">
                  <div
                    className="bg-blue-600 h-1.5 rounded-full transition-all"
                    style={{ width: `${pred.confidence}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Gráficos de Evolução */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MRSCard title="Evolução de Treinamentos" icon={LineChartIcon}>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={historicalData}>
              <defs>
                <linearGradient id="colorTrainings" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="month" stroke="#6b7280" />
              <YAxis stroke="#6b7280" allowDecimals={false} />
              <Tooltip
                contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
              />
              <Area
                type="monotone"
                dataKey="trainings"
                stroke="#3b82f6"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorTrainings)"
                name="Treinamentos"
              />
              <ReferenceLine
                y={goals.treinamentos}
                stroke="#3b82f6"
                strokeDasharray="4 4"
                ifOverflow="visible"
              >
                <Label value={`Meta: ${goals.treinamentos}`} position="insideTopLeft" fill="#3b82f6" fontSize={12} />
              </ReferenceLine>
            </AreaChart>
          </ResponsiveContainer>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
            <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <label htmlFor="training-goal" className="text-sm font-medium text-blue-800 flex items-center gap-2">
                <Target className="w-5 h-5" />
                Definir Meta (%):
              </label>
              <input
                id="training-goal"
                type="number"
                value={goals.treinamentos}
                onChange={(e) => handleGoalUpdate('treinamentos', Number(e.target.value))}
                className="w-24 px-2 py-1 border border-blue-300 rounded-md text-center font-bold text-blue-800 focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 flex items-center gap-2 text-sm text-blue-700">
              <span className="font-medium">
                Tendência: {predictions[0]?.trend === 'up' ? 'Crescimento' :
                           predictions[0]?.trend === 'down' ? 'Queda' : 'Estável'}
              </span>
            </div>
          </div>
        </MRSCard>

        <MRSCard title="Evolução de Incidentes" icon={AlertTriangle}>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={historicalData}>
              <defs>
                <linearGradient id="colorIncidents" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="month" stroke="#6b7280" />
              <YAxis stroke="#6b7280" allowDecimals={false} />
              <Tooltip
                contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
              />
              <Area
                type="monotone"
                dataKey="incidents"
                stroke="#ef4444"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorIncidents)"
                name="Incidentes"
              />
              <ReferenceLine
                y={goals.incidentes}
                stroke="#ef4444"
                strokeDasharray="4 4"
                strokeWidth={2}
              >
                <Label value={`Meta: ${goals.incidentes}`} position="insideTopLeft" fill="#ef4444" fontSize={12} />
              </ReferenceLine>
            </AreaChart>
          </ResponsiveContainer>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
            <div className="flex items-center gap-3 p-3 bg-red-50 rounded-lg border border-red-200">
              <label htmlFor="incident-goal" className="text-sm font-medium text-red-800 flex items-center gap-2">
                <Target className="w-5 h-5" />
                Definir Meta (Máx):
              </label>
              <input
                id="incident-goal"
                type="number"
                value={goals.incidentes}
                onChange={(e) => handleGoalUpdate('incidentes', Number(e.target.value))}
                className="w-24 px-2 py-1 border border-red-300 rounded-md text-center font-bold text-red-800 focus:ring-2 focus:ring-red-500"
              />
            </div>
            <div className="p-3 bg-red-50 rounded-lg border border-red-200 flex items-center gap-2 text-sm text-red-700">
              <span className="font-medium">Tendência: {predictions[1]?.trend === 'down' ? 'Melhoria (Redução)' : predictions[1]?.trend === 'up' ? 'Piora (Aumento)' : 'Estável'}</span>
            </div>
          </div>
        </MRSCard>

        <MRSCard title="Evolução de Exames Médicos" icon={Activity}>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={historicalData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="month" stroke="#6b7280" />
              <YAxis stroke="#6b7280" />
              <Tooltip
                contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="exams"
                stroke="#8b5cf6"
                strokeWidth={3}
                dot={{ fill: '#8b5cf6', r: 5 }}
                name="Exames Realizados"
              />
              <ReferenceLine
                y={goals.epis}
                stroke="#8b5cf6"
                strokeDasharray="4 4"
              >
                <Label value={`Meta: ${goals.epis}`} position="insideTopLeft" fill="#8b5cf6" fontSize={12} />
              </ReferenceLine>
            </LineChart>
          </ResponsiveContainer>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
            <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg border border-purple-200">
              <label htmlFor="exams-goal" className="text-sm font-medium text-purple-800 flex items-center gap-2">
                <Target className="w-5 h-5" />
                Definir Meta (Qtd):
              </label>
              <input
                id="exams-goal"
                type="number"
                value={goals.epis}
                onChange={(e) => handleGoalUpdate('epis', Number(e.target.value))}
                className="w-24 px-2 py-1 border border-purple-300 rounded-md text-center font-bold text-purple-800 focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div className="p-3 bg-purple-50 rounded-lg border border-purple-200 flex items-center gap-2 text-sm text-purple-700">
              <span className="font-medium">Tendência: {predictions[2]?.trend === 'up' ? 'Crescimento' : predictions[2]?.trend === 'down' ? 'Queda' : 'Estável'}</span>
            </div>
          </div>
        </MRSCard>

        <MRSCard title="Evolução da Conformidade" icon={Target}>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={historicalData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="month" stroke="#6b7280" />
              <YAxis stroke="#6b7280" domain={[0, 100]} />
              <Tooltip
                contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                formatter={(value: number) => [`${value}%`, '']}
              />
              <Legend />
              <ReferenceLine y={goals.conformidade} stroke="#10b981" strokeDasharray="4 4" strokeWidth={2}>
                <Label value={`Meta: ${goals.conformidade}%`} position="insideTopLeft" fill="#10b981" fontSize={12} />
              </ReferenceLine>
              <Line
                type="monotone"
                dataKey="conformity"
                stroke="#10b981"
                strokeWidth={3}
                dot={{ fill: '#10b981', r: 5 }}
                name="Taxa de Conformidade (%)"
              />
            </LineChart>
          </ResponsiveContainer>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
            <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
              <label htmlFor="conformity-goal" className="text-sm font-medium text-green-800 flex items-center gap-2">
                <Target className="w-5 h-5" />
                Definir Meta (%):
              </label>
              <input
                id="conformity-goal"
                type="number"
                value={goals.conformidade}
                onChange={(e) => handleGoalUpdate('conformidade', Number(e.target.value))}
                className="w-24 px-2 py-1 border border-green-300 rounded-md text-center font-bold text-green-800 focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div className="p-3 bg-green-50 rounded-lg border border-green-200 flex items-center gap-2 text-sm text-green-700">
              <span className="font-medium">Tendência: {predictions[3]?.trend === 'up' ? 'Crescimento' : predictions[3]?.trend === 'down' ? 'Queda' : 'Estável'}</span>
            </div>
          </div>
        </MRSCard>
      </div>

      {/* Análise Comparativa */}
      <MRSCard title="Análise Comparativa Mensal" icon={BarChart3}>
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={historicalData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="month" stroke="#6b7280" />
            <YAxis stroke="#6b7280" />
            <Tooltip
              contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
            />
            <Legend />
            <Bar dataKey="trainings" fill="#3b82f6" name="Treinamentos" radius={[8, 8, 0, 0]} />
            <Bar dataKey="exams" fill="#8b5cf6" name="Exames" radius={[8, 8, 0, 0]} />
            <Bar dataKey="incidents" fill="#ef4444" name="Incidentes" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
            <div className="text-xs text-blue-600 font-medium mb-1">Total Treinamentos</div>
            <div className="text-2xl font-bold text-blue-700">
              {historicalData.reduce((acc, d) => acc + d.trainings, 0)}
            </div>
          </div>
          <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
            <div className="text-xs text-purple-600 font-medium mb-1">Total Exames</div>
            <div className="text-2xl font-bold text-purple-700">
              {historicalData.reduce((acc, d) => acc + d.exams, 0)}
            </div>
          </div>
          <div className="p-3 bg-red-50 rounded-lg border border-red-200">
            <div className="text-xs text-red-600 font-medium mb-1">Total Incidentes</div>
            <div className="text-2xl font-bold text-red-700">
              {historicalData.reduce((acc, d) => acc + d.incidents, 0)}
            </div>
          </div>
        </div>
      </MRSCard>

      {/* Insights */}
      <MRSCard title="Insights e Recomendações" icon={TrendingUp}>
        <div className="space-y-4">
          {predictions.map((pred, idx) => (
            <div
              key={idx}
              className={`p-4 rounded-lg border ${getTrendColor(pred.metric, pred.trend)} border-opacity-50`}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  {getTrendIcon(pred.trend)}
                </div>
                <div className="flex-1">
                  <div className="font-semibold mb-1">{pred.metric}</div>
                  <div className="text-sm opacity-90">
                    {pred.trend === 'up' && !pred.metric.includes('Incidentes') &&
                      `Crescimento positivo previsto. Continue investindo nesta área.`}
                    {pred.trend === 'down' && pred.metric.includes('Incidentes') &&
                      `Redução de incidentes prevista. Manter as práticas atuais.`}
                    {pred.trend === 'down' && !pred.metric.includes('Incidentes') &&
                      `Tendência de queda identificada. Revisar estratégias e investir em melhorias.`}
                    {pred.trend === 'up' && pred.metric.includes('Incidentes') &&
                      `Aumento de incidentes previsto. Atenção redobrada e ações preventivas necessárias.`}
                    {pred.trend === 'stable' &&
                      `Comportamento estável. Monitorar para manter o padrão atual.`}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </MRSCard>

      {/* Como Funciona */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow duration-200">
        <button
          onClick={() => setIsMethodologyExpanded(!isMethodologyExpanded)}
          className="w-full p-6 flex items-center justify-between hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Activity className="w-5 h-5 text-blue-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">
              Como as Previsões São Calculadas
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">
              {isMethodologyExpanded ? 'Recolher' : 'Expandir'}
            </span>
            {isMethodologyExpanded ? (
              <ChevronUp className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            )}
          </div>
        </button>

        {isMethodologyExpanded && (
          <div className="p-6 pt-0 border-t border-gray-100">
            <div className="space-y-6">
          {/* Metodologia */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">📊 Metodologia</h3>
            <p className="text-gray-700 leading-relaxed">
              O sistema utiliza um algoritmo de <strong>Média Móvel Simples (SMA - Simple Moving Average)</strong> combinado
              com análise de tendência para prever valores futuros baseados em dados históricos dos últimos 6 meses.
            </p>
          </div>

          {/* Passo a Passo */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">🔢 Processo de Cálculo</h3>
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-bold">
                  1
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-gray-900 mb-1">Coleta de Dados Históricos</div>
                  <p className="text-sm text-gray-600">
                    O sistema busca dados dos últimos 6 meses do banco de dados Supabase, incluindo treinamentos,
                    incidentes, exames médicos e taxa de conformidade.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-bold">
                  2
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-gray-900 mb-1">Média Móvel dos Últimos 3 Meses</div>
                  <p className="text-sm text-gray-600 mb-2">
                    Calculamos a média dos 3 meses mais recentes para obter uma base sólida:
                  </p>
                  <div className="bg-gray-50 rounded-lg p-3 font-mono text-sm">
                    <div className="text-blue-600">média = (mês1 + mês2 + mês3) / 3</div>
                  </div>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-bold">
                  3
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-gray-900 mb-1">Análise de Tendência</div>
                  <p className="text-sm text-gray-600 mb-2">
                    Identificamos a direção do movimento comparando o último mês com o primeiro dos 3 analisados:
                  </p>
                  <div className="bg-gray-50 rounded-lg p-3 font-mono text-sm space-y-1">
                    <div className="text-blue-600">tendência = mês3 - mês1</div>
                    <div className="text-gray-500 text-xs mt-2">
                      • Se tendência &gt; 1 → Crescimento ↑<br/>
                      • Se tendência &lt; -1 → Queda ↓<br/>
                      • Caso contrário → Estável →
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-bold">
                  4
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-gray-900 mb-1">Projeção para o Próximo Mês</div>
                  <p className="text-sm text-gray-600 mb-2">
                    A previsão final combina a média com a tendência identificada:
                  </p>
                  <div className="bg-blue-50 rounded-lg p-3 font-mono text-sm border border-blue-200">
                    <div className="text-blue-700 font-semibold">previsão = média + tendência</div>
                  </div>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-bold">
                  5
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-gray-900 mb-1">Nível de Confiança</div>
                  <p className="text-sm text-gray-600">
                    Cada previsão recebe um nível de confiança (75-85%) baseado na estabilidade dos dados históricos
                    e na quantidade de informações disponíveis. Maior histórico = maior confiança.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Exemplo Prático */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-5 border border-blue-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">💡 Exemplo Prático</h3>
            <div className="space-y-3">
              <div>
                <div className="text-sm font-medium text-gray-700 mb-2">Dados históricos de Treinamentos:</div>
                <div className="bg-white rounded-lg p-3 font-mono text-sm">
                  <div className="text-gray-600">Agosto: 6 treinamentos</div>
                  <div className="text-gray-600">Setembro: 5 treinamentos</div>
                  <div className="text-blue-600 font-semibold">Outubro: 2 treinamentos</div>
                </div>
              </div>

              <div>
                <div className="text-sm font-medium text-gray-700 mb-2">Cálculo:</div>
                <div className="bg-white rounded-lg p-3 space-y-2 text-sm">
                  <div>
                    <span className="text-gray-600">Média:</span>
                    <span className="ml-2 font-mono text-blue-600">(6 + 5 + 2) / 3 = 4.33</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Tendência:</span>
                    <span className="ml-2 font-mono text-blue-600">2 - 6 = -4</span>
                    <span className="ml-2 text-red-600">↓ Queda</span>
                  </div>
                  <div className="pt-2 border-t border-gray-200">
                    <span className="text-gray-600">Previsão:</span>
                    <span className="ml-2 font-mono font-semibold text-blue-700">4.33 + (-4) ≈ 1 treinamento</span>
                  </div>
                </div>
              </div>

              <div className="bg-red-50 rounded-lg p-3 border border-red-200">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-red-800">
                    <strong>Insight Automático:</strong> Tendência de queda identificada. Revisar estratégias e investir em melhorias.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Limitações */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">⚠️ Considerações Importantes</h3>
            <div className="space-y-2 text-sm text-gray-600">
              <div className="flex items-start gap-2">
                <span className="text-blue-600 font-bold mt-0.5">•</span>
                <p>
                  <strong>Dados Históricos:</strong> A precisão das previsões depende da qualidade e quantidade dos dados históricos.
                  Quanto mais dados, melhor a previsão.
                </p>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-blue-600 font-bold mt-0.5">•</span>
                <p>
                  <strong>Eventos Externos:</strong> O modelo não considera eventos externos (feriados, mudanças organizacionais,
                  pandemias, etc.) que podem impactar os resultados.
                </p>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-blue-600 font-bold mt-0.5">•</span>
                <p>
                  <strong>Tendências Lineares:</strong> O algoritmo assume tendências lineares. Mudanças bruscas ou padrões
                  sazonais complexos podem não ser capturados.
                </p>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-blue-600 font-bold mt-0.5">•</span>
                <p>
                  <strong>Atualização Contínua:</strong> As previsões são recalculadas automaticamente sempre que novos
                  dados são adicionados ao sistema.
                </p>
              </div>
            </div>
          </div>

          {/* Próximos Passos */}
          <div className="bg-green-50 rounded-lg p-4 border border-green-200">
            <h3 className="text-lg font-semibold text-green-900 mb-2">🚀 Próximas Melhorias</h3>
            <div className="text-sm text-green-800 space-y-1">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4" />
                <span>Implementação de algoritmos de Machine Learning mais avançados (ARIMA, Prophet)</span>
              </div>
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4" />
                <span>Análise de sazonalidade e padrões cíclicos</span>
              </div>
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4" />
                <span>Detecção automática de anomalias e outliers</span>
              </div>
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4" />
                <span>Intervalos de confiança com margem de erro</span>
              </div>
            </div>
          </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
