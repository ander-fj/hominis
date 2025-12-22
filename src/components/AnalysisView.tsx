import { useState } from 'react';
import { BarChart3, Download, Filter, TrendingUp, Users, AlertTriangle } from 'lucide-react';
import Card from './Card';

export default function AnalysisView() {
  const [selectedMetric1, setSelectedMetric1] = useState('absences');
  const [selectedMetric2, setSelectedMetric2] = useState('incidents');
  const [selectedPeriod, setSelectedPeriod] = useState('last-6-months');

  const metrics = [
    { value: 'absences', label: 'Faltas' },
    { value: 'delays', label: 'Atrasos' },
    { value: 'hours', label: 'Horas Trabalhadas' },
    { value: 'incidents', label: 'Acidentes' },
    { value: 'trainings', label: 'Treinamentos' },
    { value: 'ranking', label: 'Pontuação Ranking' },
  ];

  const periods = [
    { value: 'last-30-days', label: 'Últimos 30 dias' },
    { value: 'last-3-months', label: 'Últimos 3 meses' },
    { value: 'last-6-months', label: 'Últimos 6 meses' },
    { value: 'last-year', label: 'Último ano' },
  ];

  const correlationData = [
    { department: 'Operacional', metric1: 12, metric2: 4 },
    { department: 'Administrativo', metric1: 5, metric2: 1 },
    { department: 'Comercial', metric1: 8, metric2: 2 },
    { department: 'TI', metric1: 3, metric2: 0 },
  ];

  const maxMetric1 = Math.max(...correlationData.map(d => d.metric1));
  const maxMetric2 = Math.max(...correlationData.map(d => d.metric2));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Análise Integrada RH × SST</h1>
          <p className="text-slate-600 mt-1">Correlação entre indicadores de recursos humanos e segurança</p>
        </div>
        <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2">
          <Download className="w-4 h-4" />
          Exportar Análise
        </button>
      </div>

      <Card>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              <Filter className="w-4 h-4 inline mr-1" />
              Métrica 1 (RH)
            </label>
            <select
              value={selectedMetric1}
              onChange={(e) => setSelectedMetric1(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              {metrics.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Métrica 2 (SST)</label>
            <select
              value={selectedMetric2}
              onChange={(e) => setSelectedMetric2(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              {metrics.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Período</label>
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              {periods.map(p => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="bg-slate-50 rounded-lg p-6 border border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900 mb-6">Correlação por Departamento</h3>
          <div className="space-y-6">
            {correlationData.map((item) => (
              <div key={item.department} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700">{item.department}</span>
                  <div className="flex items-center gap-4 text-xs text-slate-600">
                    <span>Faltas: {item.metric1}</span>
                    <span>Acidentes: {item.metric2}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-600 to-cyan-500 rounded-full transition-all duration-500"
                      style={{ width: `${(item.metric1 / maxMetric1) * 100}%` }}
                    />
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-red-600 to-rose-500 rounded-full transition-all duration-500"
                      style={{ width: `${(item.metric2 / maxMetric2) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Insights Principais">
          <div className="space-y-3">
            <InsightItem
              icon={<TrendingUp className="w-5 h-5 text-emerald-600" />}
              title="Correlação Positiva"
              description="Departamentos com maior assiduidade apresentam 35% menos acidentes"
            />
            <InsightItem
              icon={<AlertTriangle className="w-5 h-5 text-amber-600" />}
              title="Área de Atenção"
              description="Setor Operacional requer ações preventivas de segurança"
            />
            <InsightItem
              icon={<Users className="w-5 h-5 text-blue-600" />}
              title="Melhoria Contínua"
              description="Taxa de conformidade aumentou 12% nos últimos 3 meses"
            />
          </div>
        </Card>

        <Card title="Estatísticas Consolidadas">
          <div className="space-y-4">
            <StatItem label="Coeficiente de Correlação" value="0.78" status="high" />
            <StatItem label="Variância Explicada" value="61%" status="medium" />
            <StatItem label="Índice de Confiança" value="0.92" status="high" />
            <StatItem label="Tendência Temporal" value="-8.5%" status="positive" />
          </div>
        </Card>

        <Card title="Recomendações">
          <div className="space-y-3">
            <RecommendationItem
              priority="high"
              text="Implementar treinamento adicional no setor operacional"
            />
            <RecommendationItem
              priority="medium"
              text="Revisar política de entrega de EPIs"
            />
            <RecommendationItem
              priority="low"
              text="Expandir programa de reconhecimento para setores de alto desempenho"
            />
          </div>
        </Card>
      </div>

      <Card title="Tendência Temporal Combinada">
        <div className="h-64 flex items-end justify-between gap-2 px-4">
          {[
            { month: 'Mai', rh: 65, sst: 82 },
            { month: 'Jun', rh: 72, sst: 85 },
            { month: 'Jul', rh: 68, sst: 79 },
            { month: 'Ago', rh: 78, sst: 88 },
            { month: 'Set', rh: 82, sst: 91 },
            { month: 'Out', rh: 85, sst: 94 },
          ].map((item, index) => (
            <div key={index} className="flex-1 flex flex-col items-center gap-2">
              <div className="w-full flex gap-1 items-end" style={{ height: '200px' }}>
                <div
                  className="flex-1 bg-gradient-to-t from-blue-600 to-cyan-500 rounded-t-lg transition-all duration-500 hover:opacity-80"
                  style={{ height: `${item.rh}%` }}
                  title={`RH: ${item.rh}%`}
                />
                <div
                  className="flex-1 bg-gradient-to-t from-emerald-600 to-teal-500 rounded-t-lg transition-all duration-500 hover:opacity-80"
                  style={{ height: `${item.sst}%` }}
                  title={`SST: ${item.sst}%`}
                />
              </div>
              <span className="text-xs font-medium text-slate-600">{item.month}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-center gap-6 mt-6 pt-4 border-t border-slate-200">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gradient-to-r from-blue-600 to-cyan-500 rounded"></div>
            <span className="text-sm text-slate-600">Indicadores RH</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gradient-to-r from-emerald-600 to-teal-500 rounded"></div>
            <span className="text-sm text-slate-600">Indicadores SST</span>
          </div>
        </div>
      </Card>
    </div>
  );
}

function InsightItem({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
      <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm flex-shrink-0">
        {icon}
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        <p className="text-xs text-slate-600 mt-1">{description}</p>
      </div>
    </div>
  );
}

function StatItem({ label, value, status }: { label: string; value: string; status: 'high' | 'medium' | 'positive' }) {
  const statusColors = {
    high: 'text-emerald-600',
    medium: 'text-amber-600',
    positive: 'text-blue-600',
  };

  return (
    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <span className={`text-lg font-bold ${statusColors[status]}`}>{value}</span>
    </div>
  );
}

function RecommendationItem({ priority, text }: { priority: 'high' | 'medium' | 'low'; text: string }) {
  const priorityConfig = {
    high: { color: 'bg-red-100 text-red-700 border-red-200', label: 'Alta' },
    medium: { color: 'bg-amber-100 text-amber-700 border-amber-200', label: 'Média' },
    low: { color: 'bg-blue-100 text-blue-700 border-blue-200', label: 'Baixa' },
  };

  const config = priorityConfig[priority];

  return (
    <div className={`p-3 rounded-lg border ${config.color}`}>
      <div className="flex items-start gap-2">
        <span className="text-xs font-bold px-2 py-0.5 rounded bg-white/50 flex-shrink-0">
          {config.label}
        </span>
        <p className="text-xs font-medium flex-1">{text}</p>
      </div>
    </div>
  );
}
