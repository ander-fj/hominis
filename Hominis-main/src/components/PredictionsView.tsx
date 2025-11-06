import { useState } from 'react';
import { TrendingUp, Activity, Calendar, Target, Download, Settings } from 'lucide-react';
import Card from './Card';

type PredictionModel = 'moving_average' | 'linear_regression' | 'exponential_smoothing';
type MetricType = 'absences' | 'delays' | 'incidents' | 'hours' | 'trainings';

export default function PredictionsView() {
  const [selectedModel, setSelectedModel] = useState<PredictionModel>('moving_average');
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('absences');
  const [forecastPeriods, setForecastPeriods] = useState(3);

  const models = [
    { value: 'moving_average' as PredictionModel, label: 'Média Móvel', description: 'Baseado em médias dos últimos períodos' },
    { value: 'linear_regression' as PredictionModel, label: 'Regressão Linear', description: 'Tendência linear ao longo do tempo' },
    { value: 'exponential_smoothing' as PredictionModel, label: 'Suavização Exponencial', description: 'Pesos decrescentes para dados antigos' },
  ];

  const metrics = [
    { value: 'absences' as MetricType, label: 'Faltas', unit: 'faltas' },
    { value: 'delays' as MetricType, label: 'Atrasos', unit: 'atrasos' },
    { value: 'incidents' as MetricType, label: 'Acidentes', unit: 'acidentes' },
    { value: 'hours' as MetricType, label: 'Horas Trabalhadas', unit: 'horas' },
    { value: 'trainings' as MetricType, label: 'Treinamentos', unit: 'treinamentos' },
  ];

  const historicalData = [
    { period: 'Mai', value: 28 },
    { period: 'Jun', value: 25 },
    { period: 'Jul', value: 30 },
    { period: 'Ago', value: 22 },
    { period: 'Set', value: 26 },
    { period: 'Out', value: 24 },
  ];

  const predictions = [
    { period: 'Nov', value: 23, confidence: 85 },
    { period: 'Dez', value: 21, confidence: 78 },
    { period: 'Jan', value: 22, confidence: 72 },
  ];

  const maxValue = Math.max(
    ...historicalData.map(d => d.value),
    ...predictions.map(p => p.value)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Previsões e Tendências</h1>
          <p className="text-slate-600 mt-1">Modelos preditivos para planejamento estratégico</p>
        </div>
        <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2">
          <Download className="w-4 h-4" />
          Exportar Previsões
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <Card className="lg:col-span-1">
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <Settings className="w-4 h-4" />
                Configurações
              </h3>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Métrica</label>
                  <select
                    value={selectedMetric}
                    onChange={(e) => setSelectedMetric(e.target.value as MetricType)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {metrics.map(m => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Modelo</label>
                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value as PredictionModel)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {models.map(m => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Períodos Futuros: {forecastPeriods}
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="12"
                    value={forecastPeriods}
                    onChange={(e) => setForecastPeriods(parseInt(e.target.value))}
                    className="w-full"
                  />
                </div>

                <button className="w-full px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-500 text-white rounded-lg hover:from-blue-700 hover:to-cyan-600 transition-colors text-sm font-medium">
                  Recalcular
                </button>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200">
              <h4 className="text-xs font-semibold text-slate-900 mb-2">Modelo Atual</h4>
              <p className="text-xs text-slate-600">
                {models.find(m => m.value === selectedModel)?.description}
              </p>
            </div>
          </div>
        </Card>

        <Card className="lg:col-span-3" title="Gráfico de Previsão">
          <div className="space-y-6">
            <div className="h-72 flex items-end justify-between gap-1 px-4">
              {[...historicalData, ...predictions].map((item, index) => {
                const isHistorical = index < historicalData.length;
                const height = (item.value / maxValue) * 100;

                return (
                  <div key={index} className="flex-1 flex flex-col items-center gap-2">
                    <div className="w-full relative" style={{ height: '250px' }}>
                      <div className="absolute bottom-0 w-full flex flex-col items-center gap-1">
                        <div
                          className={`w-full rounded-t-lg transition-all duration-500 hover:opacity-80 ${
                            isHistorical
                              ? 'bg-gradient-to-t from-blue-600 to-cyan-500'
                              : 'bg-gradient-to-t from-emerald-600 to-teal-500 opacity-70'
                          }`}
                          style={{ height: `${height}%` }}
                        />
                        {!isHistorical && (
                          <div className="text-xs font-bold text-emerald-600">
                            {item.value}
                          </div>
                        )}
                        {isHistorical && (
                          <div className="text-xs font-bold text-blue-600">
                            {item.value}
                          </div>
                        )}
                      </div>
                    </div>
                    <span className={`text-xs font-medium ${isHistorical ? 'text-slate-600' : 'text-emerald-600'}`}>
                      {item.period}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-center gap-6 pt-4 border-t border-slate-200">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-gradient-to-r from-blue-600 to-cyan-500 rounded"></div>
                <span className="text-sm text-slate-600">Dados Históricos</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-gradient-to-r from-emerald-600 to-teal-500 rounded opacity-70"></div>
                <span className="text-sm text-slate-600">Previsões</span>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-cyan-500 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-sm text-slate-600">Tendência Prevista</p>
              <p className="text-2xl font-bold text-slate-900">-12.5%</p>
              <p className="text-xs text-emerald-600 font-medium">Melhoria esperada</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-emerald-600 to-teal-500 rounded-lg flex items-center justify-center">
              <Target className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-sm text-slate-600">Acurácia do Modelo</p>
              <p className="text-2xl font-bold text-slate-900">87.3%</p>
              <p className="text-xs text-slate-600 font-medium">Última validação</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-violet-600 to-purple-500 rounded-lg flex items-center justify-center">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-sm text-slate-600">Intervalo de Confiança</p>
              <p className="text-2xl font-bold text-slate-900">85%</p>
              <p className="text-xs text-slate-600 font-medium">Média das previsões</p>
            </div>
          </div>
        </Card>
      </div>

      <Card title="Previsões Detalhadas">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-3 px-4 text-sm font-semibold text-slate-900">Período</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-slate-900">Valor Previsto</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-slate-900">Intervalo Inferior</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-slate-900">Intervalo Superior</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-slate-900">Confiança</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-slate-900">Tendência</th>
              </tr>
            </thead>
            <tbody>
              {predictions.map((pred, index) => (
                <tr key={index} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-3 px-4 text-sm font-medium text-slate-900">{pred.period}</td>
                  <td className="py-3 px-4 text-sm font-bold text-blue-600">{pred.value}</td>
                  <td className="py-3 px-4 text-sm text-slate-600">{pred.value - 3}</td>
                  <td className="py-3 px-4 text-sm text-slate-600">{pred.value + 3}</td>
                  <td className="py-3 px-4">
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      pred.confidence >= 80 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {pred.confidence}%
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1 text-emerald-600">
                      <TrendingUp className="w-4 h-4" />
                      <span className="text-xs font-medium">Melhoria</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Insights Preditivos">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center flex-shrink-0">
                <Calendar className="w-5 h-5 text-white" />
              </div>
              <div>
                <h4 className="font-semibold text-emerald-900">Cenário Otimista</h4>
                <p className="text-sm text-emerald-700 mt-1">
                  Com manutenção das tendências atuais, espera-se redução de 15% nas faltas nos próximos 3 meses
                </p>
              </div>
            </div>
          </div>

          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
                <Target className="w-5 h-5 text-white" />
              </div>
              <div>
                <h4 className="font-semibold text-blue-900">Recomendação</h4>
                <p className="text-sm text-blue-700 mt-1">
                  Manter investimento em treinamentos e reforçar políticas de reconhecimento
                </p>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
