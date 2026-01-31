import { useState, useEffect } from 'react';
import { Trophy, TrendingUp, Download, Filter, Award, Medal } from 'lucide-react';
import Card from './Card';
import { db } from '../lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { calculateRankings, RankingResult } from '../lib/ranking';

export default function RankingView() {
  const [rankings, setRankings] = useState<RankingResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('2025-10-01');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [departments, setDepartments] = useState<string[]>([]);

  useEffect(() => {
    loadRankings();
    loadDepartments();
  }, [selectedPeriod]);

  const loadRankings = async () => {
    setLoading(true);
    try {
      const results = await calculateRankings(selectedPeriod);
      setRankings(results);
    } catch (error) {
      console.error('Erro ao carregar rankings:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadDepartments = async () => {
    const q = query(collection(db, 'employees'), where('active', '==', true));
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      const data = snapshot.docs.map(doc => doc.data());
      const uniqueDepts = [...new Set(data.map(e => e.department))];
      setDepartments(uniqueDepts);
    }
  };

  const filteredRankings = selectedDepartment === 'all'
    ? rankings
    : rankings.filter(r => r.department === selectedDepartment);

  const getRankIcon = (position: number) => {
    if (position === 1) return <Trophy className="w-6 h-6 text-yellow-500" />;
    if (position === 2) return <Medal className="w-6 h-6 text-slate-400" />;
    if (position === 3) return <Award className="w-6 h-6 text-amber-600" />;
    return null;
  };

  const getRankBadgeColor = (position: number) => {
    if (position === 1) return 'bg-gradient-to-r from-yellow-400 to-amber-500 text-white';
    if (position === 2) return 'bg-gradient-to-r from-slate-300 to-slate-400 text-slate-800';
    if (position === 3) return 'bg-gradient-to-r from-amber-500 to-orange-500 text-white';
    return 'bg-slate-100 text-slate-700';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-slate-600 mt-4">Calculando rankings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Ranking Inteligente</h1>
          <p className="text-slate-600 mt-1">Sistema dinâmico de avaliação de colaboradores</p>
        </div>
        <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2">
          <Download className="w-4 h-4" />
          Exportar
        </button>
      </div>

      <div className="flex gap-4">
        <Card className="flex-1">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-cyan-500 rounded-lg flex items-center justify-center">
              <Trophy className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-sm text-slate-600">Total de Colaboradores</p>
              <p className="text-2xl font-bold text-slate-900">{rankings.length}</p>
            </div>
          </div>
        </Card>

        <Card className="flex-1">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-emerald-600 to-teal-500 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-sm text-slate-600">Pontuação Média</p>
              <p className="text-2xl font-bold text-slate-900">
                {rankings.length > 0
                  ? (rankings.reduce((sum, r) => sum + r.total_score, 0) / rankings.length).toFixed(1)
                  : '0'}
              </p>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <div className="flex gap-4 mb-6">
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              <Filter className="w-4 h-4 inline mr-1" />
              Período
            </label>
            <input
              type="month"
              value={selectedPeriod.slice(0, 7)}
              onChange={(e) => setSelectedPeriod(e.target.value + '-01')}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-700 mb-2">Departamento</label>
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Todos</option>
              {departments.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-3">
          {filteredRankings.slice(0, 10).map((ranking) => (
            <div
              key={ranking.employee_id}
              className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg border border-slate-200 hover:border-blue-300 hover:shadow-md transition-all duration-200"
            >
              <div className={`w-14 h-14 rounded-lg ${getRankBadgeColor(ranking.rank_position)} flex items-center justify-center font-bold text-lg shadow-md`}>
                {ranking.rank_position <= 3 ? getRankIcon(ranking.rank_position) : `#${ranking.rank_position}`}
              </div>

              <div className="flex-1">
                <h4 className="font-semibold text-slate-900 text-lg">{ranking.employee_name}</h4>
                <p className="text-sm text-slate-600">{ranking.department}</p>
              </div>

              <div className="text-right">
                <p className="text-2xl font-bold text-blue-600">{ranking.total_score.toFixed(1)}</p>
                <p className="text-xs text-slate-500">pontos</p>
              </div>

              <button className="px-4 py-2 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium text-slate-700">
                Ver Detalhes
              </button>
            </div>
          ))}
        </div>

        {filteredRankings.length === 0 && (
          <div className="text-center py-12">
            <Trophy className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-600">Nenhum ranking disponível para este período</p>
          </div>
        )}
      </Card>

      <Card title="Distribuição de Pontuações">
        <div className="space-y-4">
          {rankings.slice(0, 10).map((ranking) => (
            <div key={ranking.employee_id}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-700">{ranking.employee_name}</span>
                <span className="text-sm font-bold text-blue-600">{ranking.total_score.toFixed(1)}</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-600 to-cyan-500 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min((ranking.total_score / 100) * 100, 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
