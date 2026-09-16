import React from 'react';
import { X, Clock, AlertTriangle, BookOpen, BarChart2 } from 'lucide-react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';
import dados from '../data/dados_funcionario.json';

interface UserMetricsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function UserMetricsModal({ isOpen, onClose }: UserMetricsModalProps) {
  if (!isOpen) return null;

  const { metricasFuncionario } = dados;
  const { tempoDeCasa, frequencia, desenvolvimento, performance } = metricasFuncionario;

  // Dados simulados para preencher o gráfico, pois o texto original continha apenas os eixos
  const radarData = [
    { subject: 'Proatividade', A: 80, fullMark: 100 },
    { subject: 'Qualidade', A: 90, fullMark: 100 },
    { subject: 'Entrega', A: 85, fullMark: 100 },
    { subject: 'Colaboração', A: 70, fullMark: 100 },
    { subject: 'Assiduidade', A: 100, fullMark: 100 },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-4xl bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-2xl font-bold text-gray-800">Métricas do Colaborador</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <X className="w-6 h-6 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Tempo de Casa */}
          <div className="bg-blue-50 p-6 rounded-xl border border-blue-100">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-blue-500 rounded-lg text-white">
                <Clock className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-gray-700">Tempo de Casa</h3>
            </div>
            <p className="text-3xl font-bold text-blue-900">{tempoDeCasa.valorExibido}</p>
            <p className="text-sm text-blue-600 mt-1">Início em: {tempoDeCasa.dataInicio}</p>
          </div>

          {/* Frequência */}
          <div className="bg-red-50 p-6 rounded-xl border border-red-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-500 rounded-lg text-white">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-gray-700">Frequência</h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Faltas</p>
                <p className="text-2xl font-bold text-gray-800">{frequencia.faltas.contagem}</p>
                <p className="text-xs text-gray-400">{frequencia.faltas.rotulo}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Atrasos</p>
                <p className="text-2xl font-bold text-gray-800">{frequencia.atrasos.contagem}</p>
                <p className="text-xs text-gray-400">{frequencia.atrasos.rotulo}</p>
              </div>
            </div>
          </div>

          {/* Desenvolvimento */}
          <div className="bg-green-50 p-6 rounded-xl border border-green-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-green-500 rounded-lg text-white">
                <BookOpen className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-gray-700">Desenvolvimento</h3>
            </div>
            <div className="flex justify-between items-center">
               <div>
                <p className="text-sm text-gray-500">Treinamentos</p>
                <p className="text-2xl font-bold text-gray-800">{desenvolvimento.treinamentos}</p>
               </div>
               <div>
                <p className="text-sm text-gray-500">ConUSs</p>
                <p className="text-2xl font-bold text-gray-800">{desenvolvimento.conUSs ?? '-'}</p>
               </div>
            </div>
          </div>

          {/* Performance Radar */}
          <div className="bg-purple-50 p-6 rounded-xl border border-purple-100 md:col-span-2 md:row-span-2 flex flex-col">
             <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-purple-500 rounded-lg text-white">
                <BarChart2 className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-gray-700">Radar de Performance</h3>
            </div>
            <div className="flex-1 min-h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="subject" />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} />
                  <Radar
                    name="Performance"
                    dataKey="A"
                    stroke="#8884d8"
                    fill="#8884d8"
                    fillOpacity={0.6}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-center text-sm text-purple-600 mt-2">{performance.graficoRadar.rotulo}</p>
          </div>

        </div>
      </div>
    </div>
  );
}