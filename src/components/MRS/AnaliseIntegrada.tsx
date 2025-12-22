import { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, AlertTriangle, Users, Heart, Activity, Target, Download } from 'lucide-react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, LineChart, Line, LabelList } from 'recharts';
import MRSCard from './MRSCard';
import PeriodFilter from './PeriodFilter';
import { supabase } from '../../lib/supabase';
import { calculateDateRange } from '../../lib/dateUtils';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface CorrelationData {
  department: string;
  absences: number;
  trainings: number;
  exams_valid: number;
  incidents: number;
  avg_score: number;
}

export default function AnaliseIntegrada() {
  const [correlationData, setCorrelationData] = useState<CorrelationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('30');

  useEffect(() => {
    loadCorrelationData();
  }, [selectedPeriod]);

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

      pdf.save('Analise-Integrada.pdf');
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      alert('Erro ao gerar PDF. Tente novamente.');
    }
  };

  const loadCorrelationData = async () => {
    setLoading(true);
    try {
      const { data: employees } = await supabase
        .from('employees')
        .select('id, name, department')
        .eq('active', true);

      if (!employees) return;

      const departments = [...new Set(employees.map(e => e.department))];
      const correlations: CorrelationData[] = [];

      for (const dept of departments) {
        const deptEmployees = employees.filter(e => e.department === dept);

        let totalAbsences = 0;
        let totalTrainings = 0;
        let totalExamsValid = 0;
        let totalScores = 0;

        const { startDate, endDate } = calculateDateRange(selectedPeriod);

        for (const emp of deptEmployees) {
          // Buscar scores de assiduidade no período
          const { data: assiduityScores } = await supabase
            .from('employee_scores')
            .select('raw_value, evaluation_criteria(name)')
            .eq('employee_id', emp.id)
            .gte('period', startDate)
            .lte('period', endDate);

          const relevantScores = assiduityScores?.filter(s => s.evaluation_criteria?.name === 'Assiduidade') || [];
          relevantScores.forEach(score => {
            const assiduity = parseFloat(score.raw_value);
            if (!isNaN(assiduity)) {
              totalAbsences += Math.round((100 - assiduity) / 5);
            }
          });

          const { count: trainingsCount } = await supabase
            .from('sst_trainings')
            .select('*', { count: 'exact', head: true })
            .eq('employee_id', emp.id)
            .eq('status', 'valid')
            .gte('completion_date', startDate)
            .lte('completion_date', endDate);

          totalTrainings += trainingsCount || 0;

          const { count: examsCount } = await supabase
            .from('sst_medical_exams')
            .select('*', { count: 'exact', head: true })
            .eq('employee_id', emp.id)
            .eq('status', 'valid')
            .gte('exam_date', startDate)
            .lte('exam_date', endDate);

          totalExamsValid += examsCount || 0;

          const { data: scores } = await supabase
            .from('employee_scores')
            .select('normalized_score')
            .eq('employee_id', emp.id)
            .gte('period', startDate)
            .lte('period', endDate);

          if (scores && scores.length > 0) {
            const avgScore = scores.reduce((sum, s) => sum + Number(s.normalized_score), 0) / scores.length;
            totalScores += avgScore;
          }
        }

        const { data: incidents } = await supabase
          .from('sst_incidents')
          .select('id')
          .eq('department', dept)
          .gte('incident_date', startDate)
          .lte('incident_date', endDate);

        correlations.push({
          department: dept,
          absences: totalAbsences,
          trainings: totalTrainings,
          exams_valid: totalExamsValid,
          incidents: incidents?.length || 0,
          avg_score: deptEmployees.length > 0 ? totalScores / deptEmployees.length : 0,
        });
      }

      setCorrelationData(correlations);
    } catch (error) {
      console.error('Erro ao carregar correlações:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-[#ffcc00] mx-auto"></div>
          <p className="text-gray-600 mt-4 font-medium">Analisando correlações...</p>
        </div>
      </div>
    );
  }

  const totalAbsences = correlationData.reduce((sum, d) => sum + d.absences, 0);
  const totalTrainings = correlationData.reduce((sum, d) => sum + d.trainings, 0);
  const totalIncidents = correlationData.reduce((sum, d) => sum + d.incidents, 0);
  const avgScore = correlationData.length > 0
    ? correlationData.reduce((sum, d) => sum + d.avg_score, 0) / correlationData.length
    : 0;

  const absenceTrainingData = correlationData.map(d => ({
    department: d.department.substring(0, 10),
    absences: d.absences,
    trainings: d.trainings,
  }));

  const riskCorrelation = correlationData.map(d => ({
    absences: d.absences,
    incidents: d.incidents,
    department: d.department,
  }));

  const performanceData = correlationData.map(d => ({
    department: d.department.substring(0, 10),
    score: d.avg_score.toFixed(1),
    exams: d.exams_valid,
    trainings: d.trainings,
    absences: d.absences,
    incidents: d.incidents,
  }));

  const CustomizedLabel = (props: any) => {
    const { x, y, stroke, value } = props;
    return (
      <text x={x} y={y} dy={-10} fill={stroke} fontSize={12} fontWeight="bold" textAnchor="middle">
        {value}
      </text>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#002b55] flex items-center gap-3">
            <BarChart3 className="w-8 h-8 text-[#ffcc00]" />
            Análise Integrada RH × SST
          </h1>
          <p className="text-gray-600 mt-1">Análise de correlação entre indicadores de RH e SST</p>
        </div>
        <div className="flex gap-2">
          <PeriodFilter
            selectedPeriod={selectedPeriod}
            onPeriodChange={setSelectedPeriod}
          />
          <button
            onClick={handleExportPDF}
            className="px-4 py-2 bg-gradient-to-r from-[#002b55] to-[#003d73] text-white rounded-lg hover:shadow-lg transition-all duration-200 flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Exportar PDF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MRSCard>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-red-600 rounded-lg flex items-center justify-center shadow-lg">
              <AlertTriangle className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-xs text-gray-600">Total Faltas</p>
              <p className="text-2xl font-bold text-[#002b55]">{totalAbsences}</p>
            </div>
          </div>
        </MRSCard>

        <MRSCard>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center shadow-lg">
              <Users className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-xs text-gray-600">Treinamentos Válidos</p>
              <p className="text-2xl font-bold text-[#002b55]">{totalTrainings}</p>
            </div>
          </div>
        </MRSCard>

        <MRSCard>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center shadow-lg">
              <Heart className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-xs text-gray-600">Incidentes SST</p>
              <p className="text-2xl font-bold text-[#002b55]">{totalIncidents}</p>
            </div>
          </div>
        </MRSCard>

        <MRSCard>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center shadow-lg">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-xs text-gray-600">Score Médio</p>
              <p className="text-2xl font-bold text-[#002b55]">{avgScore.toFixed(1)}</p>
            </div>
          </div>
        </MRSCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MRSCard title="Faltas vs Treinamentos por Departamento" icon={Target}>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={absenceTrainingData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="department" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="absences" fill="#ef4444" name="Faltas">
                <LabelList dataKey="absences" position="top" style={{ fill: '#ef4444', fontSize: 12, fontWeight: 'bold' }} />
              </Bar>
              <Bar dataKey="trainings" fill="#3b82f6" name="Treinamentos">
                <LabelList dataKey="trainings" position="top" style={{ fill: '#3b82f6', fontSize: 12, fontWeight: 'bold' }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm text-blue-900 font-semibold">Insight</p>
            <p className="text-sm text-blue-800 mt-1">
              Departamentos com mais treinamentos tendem a ter menos faltas.
              Investir em capacitação pode reduzir absenteísmo.
            </p>
          </div>
        </MRSCard>

        <MRSCard title="Correlação: Faltas × Incidentes SST" icon={AlertTriangle}>
          <ResponsiveContainer width="100%" height={300}>
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="absences" name="Faltas" />
              <YAxis dataKey="incidents" name="Incidentes" />
              <Tooltip cursor={{ strokeDasharray: '3 3' }} />
              <Legend />
              <Scatter
                name="Departamentos"
                data={riskCorrelation}
                fill="#ff6b6b"
              />
            </ScatterChart>
          </ResponsiveContainer>
          <div className="mt-4 p-4 bg-orange-50 rounded-lg border border-orange-200">
            <p className="text-sm text-orange-900 font-semibold">Insight</p>
            <p className="text-sm text-orange-800 mt-1">
              Correlação positiva entre faltas e incidentes sugere que ausências
              podem estar relacionadas a condições de trabalho inadequadas.
            </p>
          </div>
        </MRSCard>
      </div>
              
      <MRSCard title="Performance vs Investimento em SST" icon={TrendingUp}>
            <ResponsiveContainer width="100%" height={300}>
            <LineChart data={performanceData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="department" />
            <YAxis yAxisId="left" tick={false} />
            <YAxis yAxisId="right" orientation="right" tick={false} />
            <Tooltip />
            <Legend />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="score"
              stroke="#ffcc00"
              strokeWidth={3}
              name="Score Médio"
              dot={{ fill: '#ffcc00', r: 6 }}
              label={<CustomizedLabel />}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="exams"
              stroke="#10b981"
              strokeWidth={2}
              name="Exames Válidos"
              dot={{ fill: '#10b981', r: 5 }}
              label={<CustomizedLabel />}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="trainings"
              stroke="#3b82f6"
              strokeWidth={2}
              name="Treinamentos"
              dot={{ fill: '#3b82f6', r: 5 }}
              label={<CustomizedLabel />}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="absences"
              stroke="#ef4444"
              strokeWidth={2}
              name="Faltas"
              dot={{ fill: '#ef4444', r: 5 }}
              label={<CustomizedLabel />}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="incidents"
              stroke="#f97316"
              strokeWidth={2}
              name="Incidentes"
              dot={{ fill: '#f97316', r: 5 }}
              label={<CustomizedLabel />}
            />
          </LineChart>
        </ResponsiveContainer>
        <div className="mt-4 p-4 bg-green-50 rounded-lg border border-green-200">
          <p className="text-sm text-green-900 font-semibold">Insight Estratégico</p>
          <p className="text-sm text-green-800 mt-1">
            Departamentos com maior investimento em exames e treinamentos SST apresentam
            scores de performance superiores, demonstrando retorno direto do investimento
            em segurança e saúde para a produtividade.
          </p>
        </div>
      </MRSCard>

      <MRSCard title="Conclusões e Recomendações" icon={Target}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="font-semibold text-[#002b55] mb-3 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
              Pontos de Atenção
            </h3>
            <ul className="space-y-2 text-sm text-gray-700">
              <li className="flex items-start gap-2">
                <span className="text-red-500 mt-1">•</span>
                <span>Alta correlação entre faltas e incidentes indica necessidade de investigação</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-500 mt-1">•</span>
                <span>Departamentos com poucos treinamentos apresentam maior absenteísmo</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-500 mt-1">•</span>
                <span>Exames médicos vencidos podem indicar riscos à saúde ocupacional</span>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-[#002b55] mb-3 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-500" />
              Recomendações Estratégicas
            </h3>
            <ul className="space-y-2 text-sm text-gray-700">
              <li className="flex items-start gap-2">
                <span className="text-green-500 mt-1">✓</span>
                <span>Intensificar programa de treinamentos nos departamentos críticos</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500 mt-1">✓</span>
                <span>Implementar programa preventivo de saúde ocupacional</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500 mt-1">✓</span>
                <span>Criar incentivos para colaboradores com excelente assiduidade</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500 mt-1">✓</span>
                <span>Realizar auditoria de segurança em áreas com mais incidentes</span>
              </li>
            </ul>
          </div>
        </div>
      </MRSCard>
    </div>
  );
}
