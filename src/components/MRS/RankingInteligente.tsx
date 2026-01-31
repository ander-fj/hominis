import { useState, useEffect, useMemo } from 'react';
import { Trophy, Download, Filter, TrendingUp, TrendingDown, FileText, Info, CheckCircle2, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
// Removed framer-motion to fix DOM errors
import { collection, getDocs, query, where, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend, LabelList } from 'recharts';
import MRSCard from './MRSCard';
import { calculateIntelligentRanking, RankingResult, generatePerformanceData } from '../../lib/rankingEngine';
import { formatNumber, getCurrentMonth } from '../../lib/format';
import { getMedalEmoji, getMedalColor } from '../../lib/theme'; // Presuming theme is independent
import { exportRankingToPDF, exportRankingToXLSX } from '../../lib/exportUtils'; // Presuming export is independent
import html2canvas from 'html2canvas';
import { db } from '../../lib/firebase';
import { getTenantCollection } from '../../lib/tenantUtils';
import jsPDF from 'jspdf';

interface EvaluationCriteria {
  id: string;
  name: string;
  description: string;
  weight: number;
  direction: 'higher_better' | 'lower_better';
  display_order: number;
  active: boolean;
}

export default function RankingInteligente() {
  const [rankings, setRankings] = useState<RankingResult[]>([]);
  const [loading, setLoading] = useState(true);

  const [refreshing, setRefreshing] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [selectedEmployee, setSelectedEmployee] = useState<RankingResult | null>(null);
  const [departments, setDepartments] = useState<string[]>([]);
  const [criteria, setCriteria] = useState<EvaluationCriteria[]>([]);
  const [showRules, setShowRules] = useState(true);
  const [employeeHistory, setEmployeeHistory] = useState<Array<{
    period: string;
    rank_position: number;
    total_score: number;
  }>>([]);

  const [availablePeriods, setAvailablePeriods] = useState<{ value: string; label: string }[]>([]);

  useEffect(() => {
    let unsubscribeRankings: () => void;

    const loadData = async () => {
      setLoading(true);
      try {
        // 1. Carregar Critérios de Avaliação
        const criteriaQuery = query(getTenantCollection('evaluation_criteria'), where('active', '==', true));
        const criteriaSnapshot = await getDocs(criteriaQuery);
        const criteriaData = (criteriaSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as EvaluationCriteria[])
          .sort((a, b) => a.display_order - b.display_order);
        setCriteria(criteriaData);

        // Fetch available periods from rankings
        const periodsQuery = query(getTenantCollection('employee_rankings'), orderBy('period', 'desc'));
        const periodsSnapshot = await getDocs(periodsQuery);
        const uniquePeriods = new Set<string>();
        
        periodsSnapshot.docs.forEach(doc => {
          const p = doc.data().period;
          if (p && p !== 'consolidated') uniquePeriods.add(p);
        });
        
        // Também buscar dos scores para garantir que períodos com dados mas sem ranking apareçam
        const scoresQuery = query(getTenantCollection('employee_scores'), orderBy('period', 'desc'), limit(2000));
        const scoresSnapshot = await getDocs(scoresQuery);
        scoresSnapshot.forEach(doc => {
          const p = doc.data().period;
          if (p && /^\d{4}-\d{2}/.test(p)) uniquePeriods.add(p);
        });

        const periods = [...uniquePeriods].sort().reverse();

        const periodOptionsMap = new Map();
        
        periods.forEach(p => {
          const label = new Date(p + 'T00:00:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
          if (!periodOptionsMap.has(label) || p.length > periodOptionsMap.get(label).value.length) {
            periodOptionsMap.set(label, { value: p, label });
          }
        });

        const periodOptions = Array.from(periodOptionsMap.values());
        setAvailablePeriods(periodOptions);

        // 2. Carregar Rankings
        const periodToLoad = !selectedPeriod || selectedPeriod === '' ? 'consolidated' : selectedPeriod;
        const rankingsQuery = query(getTenantCollection('employee_rankings'), where('period', '==', periodToLoad));
        
        unsubscribeRankings = onSnapshot(rankingsQuery, async (snapshot) => {
          let results: RankingResult[] = snapshot.docs.map(doc => doc.data() as RankingResult);

          // Fallback para cálculo local se não houver rankings pré-calculados
          if (results.length === 0) {
            console.warn(`Nenhum ranking pré-calculado encontrado para o período '${periodToLoad}'. Calculando localmente...`);
            try {
              const calculated = await calculateIntelligentRanking(periodToLoad, true);
              // Se for consolidado ou se o listener não disparar, usamos o resultado calculado
              if (periodToLoad === 'consolidated' || calculated.length > 0) {
                results = calculated;
              }
            } catch (error) {
              console.error("Erro ao calcular ranking automaticamente:", error);
            }
          }

          // Ordenar por pontuação
          results.sort((a, b) => b.total_score - a.total_score);

          setRankings(results);

          // 3. Extrair Departamentos
          const depts = [...new Set(results.map(r => r.department))];
          setDepartments(depts);
          setLoading(false);
        });

      } catch (error) {
        console.error("Erro ao carregar dados do Firestore:", error);
        // Opcional: Adicionar estado de erro para exibir na UI
      }
    };

    loadData();

    return () => {
      if (unsubscribeRankings) unsubscribeRankings();
    };
  }, [selectedPeriod, selectedDepartment]);

  useEffect(() => {
    if (selectedEmployee) {
      // A lógica de carregamento de dados foi desativada temporariamente
      // para remover a dependência do Supabase.
      loadEmployeeHistory(selectedEmployee.employee_id);
    }
  }, [selectedEmployee]);

  const handleExportFullPagePDF = async () => {
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

      pdf.save('Ranking-Inteligente-Completo.pdf');
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      alert('Erro ao gerar PDF. Tente novamente.');
    }
  };

  const loadRankingsOnly = async () => {
    // TODO: Implementar a lógica de carregamento de dados usando o Firebase Firestore.
  };

  const initializeRankings = async () => {
    // TODO: Implementar a lógica de carregamento de dados usando o Firebase Firestore.
  };

  const loadEmployeeHistory = async (employeeId: string) => {
    try {
      const historyQuery = query(
        getTenantCollection('employee_rankings'),
        where('employee_id', '==', employeeId),
      );
      const historySnapshot = await getDocs(historyQuery);
      const historyData = historySnapshot.docs.map(doc => doc.data() as { period: string; rank_position: number; total_score: number })
        .sort((a, b) => a.period.localeCompare(b.period));
      setEmployeeHistory(historyData);
    } catch (error) {
      console.error('Erro ao carregar histórico do colaborador:', error);
      setEmployeeHistory([]);
    }
  };

  const loadCriteria = async () => {
    const criteriaQuery = query(getTenantCollection('evaluation_criteria'), where('active', '==', true));
    const criteriaSnapshot = await getDocs(criteriaQuery);
    const criteriaData = (criteriaSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as EvaluationCriteria[])
      .sort((a, b) => a.display_order - b.display_order);
    setCriteria(criteriaData);
  };

  const loadEmployeeDetails = async (ranking: RankingResult) => {
    // Abre o modal imediatamente com os dados básicos
    setSelectedEmployee(ranking);

    try {
      // Garante que os critérios estejam carregados
      let criteriaData = criteria;
      if (criteriaData.length === 0) {
        const criteriaQuery = query(getTenantCollection('evaluation_criteria'), where('active', '==', true));
        const criteriaSnapshot = await getDocs(criteriaQuery);
        criteriaData = (criteriaSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as EvaluationCriteria[])
          .sort((a, b) => a.display_order - b.display_order);
        setCriteria(criteriaData);
      }

      // Busca os detalhes do ranking do colaborador no período correto
      const periodToLoad = !selectedPeriod || selectedPeriod === '' ? 'consolidated' : selectedPeriod;
      const rankingDetailsQuery = query(
        getTenantCollection('employee_rankings'),
        where('employee_id', '==', ranking.employee_id)
      );
      const rankingDetailsSnapshot = await getDocs(rankingDetailsQuery);

      const rankingDetailsDoc = rankingDetailsSnapshot.docs.find(doc => doc.data().period === periodToLoad);

      if (!rankingDetailsDoc) {
        throw new Error("Detalhes do ranking não encontrados para este colaborador no período.");
      }

      const rankingDetails = rankingDetailsDoc.data() as RankingResult;

      const strengths = (rankingDetails.strengths || []).length > 0 ? rankingDetails.strengths : ['Performance estável'];
      const suggestions = (rankingDetails.suggestions || []).length > 0 ? rankingDetails.suggestions : ['Manter o bom desempenho'];

      const enrichedRanking = {
        ...rankingDetails,
        strengths,
        suggestions,
      };

      setSelectedEmployee(enrichedRanking);

    } catch (error) {
      console.error('❌ Erro ao carregar detalhes do colaborador:', error);
      // Mantém o modal aberto, mas com uma mensagem de erro
      setSelectedEmployee({ ...ranking, strengths: ['Erro ao carregar dados.'], suggestions: ['Tente novamente.'] });
    }
  };

  const loadRankings = async () => {
    // TODO: Implementar a lógica de carregamento de dados usando o Firebase Firestore.
  };

  const handleRefresh = async () => {
    if (!selectedPeriod || selectedPeriod === '') {
      // Se estiver no consolidado, perguntar se quer recalcular tudo encontrado
      if (confirm('Deseja buscar e recalcular rankings para TODOS os períodos encontrados nos dados?')) {
        setRefreshing(true);
        try {
           const scoresQuery = query(getTenantCollection('employee_scores'));
           const scoresSnapshot = await getDocs(scoresQuery);
           const periods = new Set<string>();
           scoresSnapshot.forEach(doc => {
             const p = doc.data().period;
             if (p && /^\d{4}-\d{2}$/.test(p)) periods.add(p);
           });
           
           for (const period of periods) {
             await calculateIntelligentRanking(period, true);
           }
           window.location.reload();
        } catch (e) {
           alert('Erro ao recalcular: ' + e);
        } finally {
           setRefreshing(false);
        }
        return;
      } else {
        return;
      }
    }

    setRefreshing(true);
    try {
      const results = await calculateIntelligentRanking(selectedPeriod, false);
      setRankings(results);

      const depts = [...new Set(results.map(r => r.department))];
      setDepartments(depts);

      await loadCriteria();
    } catch (error) {
      console.error('Erro ao atualizar rankings:', error);
      alert('❌ Erro ao atualizar rankings:\n\n' + (error as Error).message);
    } finally {
      setRefreshing(false);
    }
  };

  const handleGenerateData = async () => {
    if (!selectedPeriod || selectedPeriod === '') {
      alert('⚠️ Por favor, selecione um período primeiro!\n\nVocê precisa escolher um mês/ano específico antes de gerar os dados de performance.');
      return;
    }

    setRefreshing(true);
    try {
      await generatePerformanceData(selectedPeriod);
      await loadRankings();
      alert('✅ Dados de performance atualizados com sucesso!');
    } catch (error) {
      console.error('Erro ao gerar dados:', error);
      alert('❌ Erro ao atualizar dados:\n\n' + (error as Error).message);
    } finally {
      setRefreshing(false);
    }
  };

  const filteredRankings = useMemo(() => {
    const filtered = selectedDepartment === 'all'
      ? rankings
      : rankings.filter(r => r.department === selectedDepartment);

    return filtered.map((r, index) => ({
      ...r,
      rank_position: index + 1
    }));
  }, [rankings, selectedDepartment]);

  const filteredDepartments = useMemo(() => {
    if (selectedDepartment === 'all') {
      return departments;
    }
    return [selectedDepartment];
  }, [departments, selectedDepartment]);

  const chartDataWithCriteria = useMemo(() => {
    return filteredRankings.map(employee => {
      const employeeData: { [key: string]: any } = { employee_name: employee.employee_name, total_score: employee.total_score };
      criteria.forEach(criterion => {
        const scores = employee.criterion_scores || [];
        employeeData[criterion.name] = scores.find(cs => cs.criterion_id === criterion.id)?.weighted_score || 0;
      });
      return employeeData;
    }).sort((a, b) => b.total_score - a.total_score);
  }, [filteredRankings, criteria]);

  const getRankingChartData = () => {
    const uniqueRankings = new Map();

    employeeHistory.forEach((h) => {
      if (h.period === 'consolidated' || !/^\d{4}-\d{2}/.test(h.period)) return;

      const [year, month] = h.period.split('-');
      const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      const periodKey = `${monthNames[parseInt(month) - 1]}/${year.slice(2)}`;

      // Usa Map para garantir apenas um registro por período (chave)
      uniqueRankings.set(periodKey, {
        period: periodKey,
        posicao: h.rank_position,
        pontuacao: h.total_score,
        rawPeriod: h.period // para ordenação se necessário
      });
    });

    return Array.from(uniqueRankings.values()).sort((a: any, b: any) => {
      // Ordenação simples baseada no rawPeriod se disponível, ou lógica customizada
      if (a.rawPeriod && b.rawPeriod) return a.rawPeriod.localeCompare(b.rawPeriod);
      return 0;
    });
  };

  /* Código antigo removido para referência:
  const getRankingChartData = () => {
    const uniqueHistory = employeeHistory
      .filter(h => h.period !== 'consolidated' && /^\d{4}-\d{2}$/.test(h.period))
      .reduce((acc: any[], current) => {
        if (!acc.find(item => item.period === current.period)) {
          acc.push(current);
        }
        return acc;
      }, [])
      .sort((a: any, b: any) => a.period.localeCompare(b.period));

    return uniqueHistory.map((h) => {
      const [year, month] = h.period.split('-');
      const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      return {
        period: `${monthNames[parseInt(month) - 1]}/${year.slice(2)}`,
        posicao: h.rank_position,
        pontuacao: h.total_score
      };
    });
  };
  */

  if (loading && rankings.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-[#ffcc00] mx-auto"></div>
          <p className="text-gray-600 mt-4 font-medium">Carregando rankings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#912325] flex items-center gap-3">
            <Trophy className="w-8 h-8 text-[#f97316]" />
            Ranking Inteligente de Colaboradores
          </h1>
          <p className="text-gray-600 mt-1">Sistema dinâmico de avaliação com critérios configuráveis</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="px-4 py-2 bg-white border-2 border-[#912325] text-[#912325] rounded-lg hover:bg-[#912325] hover:text-white transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Atualizar dados"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Atualizando...' : 'Atualizar'}
          </button>
          <button
            onClick={handleExportFullPagePDF}
            className="px-4 py-2 bg-gradient-to-r from-[#912325] to-[#701a1c] text-white rounded-lg hover:shadow-lg transition-all flex items-center gap-2"
            title="Exportar página completa em PDF"
          >
            <FileText className="w-4 h-4" />
            PDF
          </button>
          <button
            onClick={() => exportRankingToXLSX(filteredRankings)}
            className="px-4 py-2 bg-white border-2 border-gray-300 text-gray-700 font-semibold rounded-lg hover:shadow-lg hover:bg-gray-50 transition-all flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            XLSX
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MRSCard>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-[#912325] to-[#701a1c] rounded-xl flex items-center justify-center shadow-lg">
              <Trophy className="w-7 h-7 text-[#f97316]" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total de Colaboradores</p>
              <p className="text-3xl font-bold text-[#912325]">{filteredRankings.length}</p>
            </div>
          </div>
        </MRSCard>

        <MRSCard>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-[#f97316] to-[#fb923c] rounded-xl flex items-center justify-center shadow-lg">
              <TrendingUp className="w-7 h-7 text-white" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Pontuação Média</p>
              <p className="text-3xl font-bold text-[#912325]">
                {filteredRankings.length > 0
                  ? formatNumber(filteredRankings.reduce((sum, r) => sum + r.total_score, 0) / filteredRankings.length, 1)
                  : '0'}
              </p>
            </div>
          </div>
        </MRSCard>

        <MRSCard>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-xl flex items-center justify-center shadow-lg">
              <Filter className="w-7 h-7 text-white" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Departamentos</p>
              <p className="text-3xl font-bold text-[#912325]">
                {filteredDepartments.length}
              </p>
              {selectedDepartment !== 'all' && (
                <p className="text-xs text-gray-500 mt-1">{selectedDepartment}</p>
              )}
            </div>
          </div>
        </MRSCard>
      </div>

      <MRSCard>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Período de Avaliação
            </label>
            <select
              value={selectedPeriod}
              onChange={(e) => {
                console.log('Período alterado para:', e.target.value);
                setSelectedPeriod(e.target.value);
              }}
              disabled={loading}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#912325] focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">📊 Consolidado (Todos os Períodos)</option>
              {availablePeriods.map(period => (
                <option key={period.value} value={period.value}>
                  {period.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Departamento</label>
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#912325] focus:border-transparent"
            >
              <option value="all">Todos os Departamentos</option>
              {departments.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 mb-6">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#912325] text-white rounded-lg hover:bg-[#701a1c] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Atualizando...' : 'Atualizar Rankings'}
          </button>

          <button
            onClick={handleGenerateData}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2.5 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <TrendingUp className="w-4 h-4" />
            {refreshing ? 'Atualizando...' : 'Atualizar Dados'}
          </button>

          <button
            onClick={() => exportRankingToPDF(filteredRankings, criteria)}
            className="flex items-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            <FileText className="w-4 h-4" />
            Exportar PDF
          </button>

          <button
            onClick={() => exportRankingToXLSX(filteredRankings, criteria)}
            className="flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            Exportar Excel
          </button>
        </div>

        {/* Pódio dos 3 Primeiros */}
        {filteredRankings.length >= 3 && (
          <div className="mb-8">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-[#912325] mb-2 flex items-center justify-center gap-3">
                <Trophy className="w-8 h-8 text-[#f97316]" />
                Top 3 - Pódio dos Campeões
                <Trophy className="w-8 h-8 text-[#f97316]" />
              </h2>
              <p className="text-gray-600">Os melhores colaboradores do período</p>
            </div>
            <div className="flex items-end justify-center gap-4 mb-8">
              {/* 2º Lugar - Esquerda */}
              <div
                key={`podium-2-${selectedPeriod}`}
                onClick={() => loadEmployeeDetails(filteredRankings[1])}
                className="flex flex-col items-center cursor-pointer group animate-fade-in-up"
                style={{ animationDelay: '0.1s' }}
              >
                <div className="relative mb-3">
                  {filteredRankings[1].photo_url ? (
                    <img
                      src={filteredRankings[1].photo_url}
                      alt={filteredRankings[1].employee_name}
                      className="w-24 h-24 rounded-2xl object-cover shadow-2xl border-4 border-gray-300 group-hover:scale-110 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-gray-300 to-gray-400 flex items-center justify-center shadow-2xl border-4 border-gray-300 group-hover:scale-110 transition-transform duration-300">
                      <span className="text-4xl">🥈</span>
                    </div>
                  )}
                  <div className="absolute -bottom-2 -right-2 w-12 h-12 rounded-full bg-gradient-to-br from-gray-300 to-gray-400 flex items-center justify-center shadow-xl border-4 border-white">
                    <span className="text-2xl">🥈</span>
                  </div>
                </div>
                <div className="bg-gradient-to-br from-gray-300 to-gray-400 rounded-t-2xl px-6 py-8 shadow-xl text-center min-w-[200px] group-hover:shadow-2xl transition-shadow duration-300">
                  <div className="text-6xl font-bold text-white mb-2">2º</div>
                  <h3 className="font-bold text-lg text-[#912325] mb-1">{filteredRankings[1].employee_name}</h3>
                  <p className="text-sm text-gray-700 mb-3">{filteredRankings[1].department}</p>
                  <div className="bg-white/50 rounded-xl px-4 py-2">
                    <p className="text-3xl font-bold text-[#912325]">{formatNumber(filteredRankings[1].total_score, 1)}</p>
                    <p className="text-xs text-gray-700 font-medium">pontos</p>
                  </div>
                </div>
              </div>

              {/* 1º Lugar - Centro (mais alto) */}
              <div
                key={`podium-1-${selectedPeriod}`}
                onClick={() => loadEmployeeDetails(filteredRankings[0])}
                className="flex flex-col items-center cursor-pointer group animate-fade-in-up"
                style={{ animationDelay: '0.05s' }}
              >
                <div className="relative mb-3">
                  {filteredRankings[0].photo_url ? (
                    <img
                      src={filteredRankings[0].photo_url}
                      alt={filteredRankings[0].employee_name}
                      className="w-32 h-32 rounded-2xl object-cover shadow-2xl border-4 border-[#f97316] group-hover:scale-110 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-32 h-32 rounded-2xl bg-gradient-to-br from-orange-300 to-orange-500 flex items-center justify-center shadow-2xl border-4 border-[#f97316] group-hover:scale-110 transition-transform duration-300">
                      <span className="text-5xl">🥇</span>
                    </div>
                  )}
                  <div className="absolute -bottom-3 -right-3 w-14 h-14 rounded-full bg-gradient-to-br from-orange-300 to-orange-500 flex items-center justify-center shadow-xl border-4 border-white">
                    <span className="text-3xl">🥇</span>
                  </div>
                </div>
                <div className="bg-gradient-to-br from-orange-300 to-orange-500 rounded-t-2xl px-8 py-12 shadow-2xl text-center min-w-[240px] group-hover:shadow-3xl transition-shadow duration-300">
                  <div className="text-7xl font-bold text-white mb-2">1º</div>
                  <h3 className="font-bold text-xl text-[#912325] mb-1">{filteredRankings[0].employee_name}</h3>
                  <p className="text-sm text-gray-800 mb-4">{filteredRankings[0].department}</p>
                  <div className="bg-white/70 rounded-xl px-4 py-3">
                    <p className="text-4xl font-bold text-[#912325]">{formatNumber(filteredRankings[0].total_score, 1)}</p>
                    <p className="text-xs text-gray-800 font-medium">pontos</p>
                  </div>
                </div>
              </div>

              {/* 3º Lugar - Direita */}
              <div
                key={`podium-3-${selectedPeriod}`}
                onClick={() => loadEmployeeDetails(filteredRankings[2])}
                className="flex flex-col items-center cursor-pointer group animate-fade-in-up"
                style={{ animationDelay: '0.15s' }}
              >
                <div className="relative mb-3">
                  {filteredRankings[2].photo_url ? (
                    <img
                      src={filteredRankings[2].photo_url}
                      alt={filteredRankings[2].employee_name}
                      className="w-20 h-20 rounded-2xl object-cover shadow-2xl border-4 border-orange-400 group-hover:scale-110 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-orange-300 to-orange-500 flex items-center justify-center shadow-2xl border-4 border-orange-400 group-hover:scale-110 transition-transform duration-300">
                      <span className="text-3xl">🥉</span>
                    </div>
                  )}
                  <div className="absolute -bottom-2 -right-2 w-10 h-10 rounded-full bg-gradient-to-br from-orange-300 to-orange-500 flex items-center justify-center shadow-xl border-4 border-white">
                    <span className="text-xl">🥉</span>
                  </div>
                </div>
                <div className="bg-gradient-to-br from-orange-300 to-orange-500 rounded-t-2xl px-6 py-6 shadow-xl text-center min-w-[180px] group-hover:shadow-2xl transition-shadow duration-300">
                  <div className="text-5xl font-bold text-white mb-2">3º</div>
                  <h3 className="font-bold text-base text-[#912325] mb-1">{filteredRankings[2].employee_name}</h3>
                  <p className="text-xs text-gray-700 mb-3">{filteredRankings[2].department}</p>
                  <div className="bg-white/50 rounded-xl px-3 py-2">
                    <p className="text-2xl font-bold text-[#912325]">{formatNumber(filteredRankings[2].total_score, 1)}</p>
                    <p className="text-xs text-gray-700 font-medium">pontos</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Resumo das Regras de Pontuação */}
        {criteria.length > 0 && (
          <div
            key={`criteria-${selectedPeriod}`}
            className="mb-8 animate-fade-in"
            style={{ animationDelay: '0.2s' }}
          >
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-6 border-2 border-blue-200 shadow-lg">
              <div
                className="flex items-center justify-between mb-4 cursor-pointer group"
                onClick={() => setShowRules(!showRules)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-[#912325] rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                    <Info className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-[#912325] group-hover:text-[#f97316] transition-colors duration-200">
                      Regras de Pontuação
                    </h3>
                    <p className="text-sm text-gray-600">Como a pontuação é calculada</p>
                  </div>
                </div>

                <button className="p-2 hover:bg-white rounded-lg transition-colors duration-200">
                  {showRules ? (
                    <ChevronUp className="w-6 h-6 text-[#912325]" />
                  ) : (
                    <ChevronDown className="w-6 h-6 text-[#912325]" />
                  )}
                </button>
              </div>

              {showRules && (
                <div className="overflow-hidden animate-fade-in">

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                    {criteria.map((criterion) => (
                      <div
                        key={criterion.id}
                        className="bg-white rounded-xl p-4 border border-blue-200 hover:border-[#f97316] hover:shadow-md transition-all duration-200"
                      >
                        <div className="flex items-start gap-3 mb-2">
                          <CheckCircle2 className="w-5 h-5 text-[#f97316] flex-shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <h4 className="font-bold text-[#912325] mb-1">{criterion.name}</h4>
                            <p className="text-xs text-gray-600 mb-2">{criterion.description}</p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                          <div className="flex items-center gap-2">
                            <div className="px-2 py-1 bg-[#f97316] bg-opacity-20 rounded-lg">
                              <span className="text-sm font-bold text-[#912325]">{criterion.weight}%</span>
                            </div>
                            <span className="text-xs text-gray-500">peso</span>
                          </div>

                          <div className="flex items-center gap-1">
                            {criterion.direction === 'higher_better' ? (
                              <>
                                <TrendingUp className="w-4 h-4 text-green-600" />
                                <span className="text-xs text-green-600 font-medium">Maior melhor</span>
                              </>
                            ) : (
                              <>
                                <TrendingDown className="w-4 h-4 text-red-600" />
                                <span className="text-xs text-red-600 font-medium">Menor melhor</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 p-4 bg-white rounded-xl border border-blue-200">
                    <p className="text-sm text-gray-700 text-center">
                      <span className="font-bold text-[#912325]">Pontuação Total:</span> Cada critério é normalizado (0-100),
                      multiplicado pelo seu peso e somado. A pontuação máxima possível é <span className="font-bold text-[#f97316]">100 pontos</span>.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Lista de todos os colaboradores */}
        {filteredRankings.length > 0 && (
          <div className="mb-6">
            <h3 className="text-xl font-bold text-[#912325] mb-1">Todos os Colaboradores</h3>
            <p className="text-sm text-gray-600">
              Ranking completo com {filteredRankings.length} colaborador{filteredRankings.length !== 1 ? 'es' : ''}
            </p>
          </div>
        )}

        <div className="space-y-3">
          {filteredRankings.map((ranking, index) => (
            <div
              key={`${selectedPeriod}-${ranking.employee_id}`}
              onClick={() => loadEmployeeDetails(ranking)}
              className="flex items-center gap-4 p-4 bg-gradient-to-r from-gray-50 to-white rounded-xl border border-gray-200 hover:border-[#f97316] hover:shadow-lg transition-all duration-300 cursor-pointer animate-fade-in-left"
              style={{ animationDelay: `${index * 0.03}s` }}
            >
              <div className="relative">
                {ranking.photo_url ? (
                  <img
                    src={ranking.photo_url}
                    alt={ranking.employee_name}
                    className="w-16 h-16 rounded-xl object-cover shadow-lg border-2 border-white"
                  />
                ) : (
                  <div className={`w-16 h-16 rounded-xl bg-gradient-to-br ${getMedalColor(ranking.rank_position)} flex items-center justify-center font-bold text-xl shadow-lg`}>
                    {ranking.rank_position <= 3 ? (
                      <span className="text-3xl">{getMedalEmoji(ranking.rank_position)}</span>
                    ) : (
                      <span className="text-[#912325]">#{ranking.rank_position}</span>
                    )}
                  </div>
                )}
                <div className={`absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-gradient-to-br ${getMedalColor(ranking.rank_position)} flex items-center justify-center font-bold text-xs shadow-lg border-2 border-white`}>
                  {ranking.rank_position <= 3 ? (
                    <span className="text-lg">{getMedalEmoji(ranking.rank_position)}</span>
                  ) : (
                    <span className="text-[#912325]">#{ranking.rank_position}</span>
                  )}
                </div>
              </div>

              <div className="flex-1">
                <h4 className="font-bold text-lg text-[#912325]">{ranking.employee_name}</h4>
                <p className="text-sm text-gray-600">{ranking.department} • {ranking.position}</p>
              </div>

              <div className="text-right">
                <p className="text-3xl font-bold text-[#f97316]">{formatNumber(ranking.total_score, 1)}</p>
                <p className="text-xs text-gray-500">pontos</p>
              </div>

              {ranking.rank_variation !== undefined && ranking.rank_variation !== 0 && (
                <div className={`flex items-center gap-1 px-3 py-1.5 rounded-full ${
                  ranking.rank_variation > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                  {ranking.rank_variation > 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                  <span className="text-sm font-bold">{Math.abs(ranking.rank_variation)}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </MRSCard>

      {selectedEmployee && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-0">
          <div className="bg-white shadow-2xl w-full flex flex-col transition-all h-full max-w-full rounded-none">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-[#912325] to-[#701a1c]">
              <div className="flex items-center gap-4">
                <Trophy className="w-8 h-8 text-[#f97316]" />
                <div>
                  <h2 className="text-2xl font-bold text-white">Análise Detalhada - {selectedEmployee.employee_name}</h2>
                  <p className="text-sm text-gray-200">{selectedEmployee.department} • {selectedEmployee.position}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportFullPagePDF}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all duration-200 flex items-center gap-2 border border-white/30"
                  title="Exportar PDF"
                >
                  <FileText className="w-4 h-4" />
                  Exportar PDF
                </button>
                <button
                  onClick={() => setSelectedEmployee(null)}
                  className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
                >
                  <span className="text-2xl">×</span>
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {!selectedEmployee.criterion_scores || selectedEmployee.criterion_scores.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64">
                  <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#f97316] mb-4"></div>
                    <p className="text-gray-600 text-lg mb-2 font-semibold">Carregando dados do colaborador...</p>
                    <p className="text-gray-400 text-sm mb-4">Aguarde enquanto buscamos as informações</p>
                    <p className="text-xs text-gray-500">
                      {selectedEmployee.employee_name} - {selectedEmployee.department}
                    </p>
                    <p className="text-xs text-gray-400 mt-2">
                      (Se demorar muito, verifique o console do navegador)
                    </p>
                  </div>
                </div>
              ) : (
                <>
              {/* Gráfico de Evolução do Ranking */}
              {employeeHistory.length > 0 && (
                <div className="bg-white border-2 border-gray-200 rounded-xl p-6 mb-6">
                  <h4 className="font-bold text-[#912325] mb-6 text-lg flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    Evolução do Ranking
                  </h4>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={getRankingChartData()}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="period" 
                        tick={{ fontSize: 12 }}
                        interval={0}
                        padding={{ left: 10, right: 10 }}
                      />
                      <YAxis 
                        yAxisId="left" 
                        reversed 
                        orientation="left" 
                        stroke="#912325"
                        domain={[1, 'dataMax + 1']}
                        label={{ value: 'Posição', angle: -90, position: 'insideLeft', style: { fill: '#912325', fontWeight: 'bold' } }}
                      />
                      <YAxis 
                        yAxisId="right" 
                        orientation="right" 
                        stroke="#f97316"
                        label={{ value: 'Pontuação', angle: 90, position: 'insideRight', style: { fill: '#f97316', fontWeight: 'bold' } }}
                      />
                      <Tooltip 
                        contentStyle={{
                          backgroundColor: 'white',
                          border: '2px solid #912325',
                          borderRadius: '8px',
                          padding: '8px'
                        }}
                      />
                      <Legend />
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="posicao"
                        stroke="#912325"
                        strokeWidth={3}
                        dot={{ r: 4, fill: '#912325' }}
                        activeDot={{ r: 6 }}
                        name="Posição"
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="pontuacao"
                        stroke="#f97316"
                        strokeWidth={3}
                        dot={{ r: 4, fill: '#f97316' }}
                        activeDot={{ r: 6 }}
                        name="Pontuação"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Main Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Radar de Performance */}
                    <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-6">
                      <h4 className="font-bold text-[#912325] mb-6 text-lg">Radar de Performance</h4>
                      <ResponsiveContainer width="100%" height={320}>
                        <RadarChart data={selectedEmployee.criterion_scores.map(cs => ({
                          criterion: cs.criterion_name,
                          score: cs.normalized_score
                        }))}>
                          <PolarGrid stroke="#d1d5db" />
                          <PolarAngleAxis
                            dataKey="criterion"
                            tick={{ fill: '#912325', fontSize: 12, fontWeight: 600 }}
                          />
                          <PolarRadiusAxis
                            angle={90}
                            domain={[0, 100]}
                            tick={{ fill: '#6b7280', fontSize: 11 }}
                          />
                          <Radar
                            name="Pontuação"
                            dataKey="score"
                            stroke="#912325"
                            fill="#f97316"
                            fillOpacity={0.7}
                            strokeWidth={2}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: 'white',
                              border: '2px solid #912325',
                              borderRadius: '8px',
                              padding: '8px'
                            }}
                          />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Pontos por Critério */}
                    <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-6">
                      <h4 className="font-bold text-[#912325] mb-6 text-lg">Pontos por Critério</h4>
                      <div className="space-y-4">
                        {selectedEmployee.criterion_scores.map(cs => (
                          <div key={cs.criterion_id}>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-semibold text-gray-700">{cs.criterion_name}</span>
                              <span className="text-sm font-bold text-[#912325]">
                                {formatNumber(cs.weighted_score, 1)} pts
                              </span>
                            </div>
                            <div className="relative">
                              <div className="w-full bg-gray-300 rounded-lg h-6 overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-[#912325] to-[#f97316] rounded-lg flex items-center justify-end pr-2 transition-all duration-500"
                                  style={{ width: `${cs.normalized_score}%` }}
                                >
                                  {cs.normalized_score > 15 && (
                                    <span className="text-xs font-bold text-white">
                                      {formatNumber(cs.normalized_score, 0)}%
                                    </span>
                                  )}
                                </div>
                              </div>
                              {cs.normalized_score <= 15 && (
                                <span className="absolute right-2 top-0 text-xs font-bold text-gray-600">
                                  {formatNumber(cs.normalized_score, 0)}%
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Pontos Fortes e Sugestões */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-green-50 border-2 border-green-200 rounded-xl p-6">
                      <h5 className="font-bold text-green-800 mb-4 text-lg">Pontos Fortes</h5>
                      <ul className="space-y-2">
                        {(selectedEmployee.strengths || []).map((s, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-green-700">
                            <span className="text-green-600 mt-0.5">•</span>
                            <span>{s}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="bg-orange-50 border-2 border-orange-200 rounded-xl p-6">
                      <h5 className="font-bold text-orange-800 mb-4 text-lg">Sugestões de Melhoria</h5>
                      <ul className="space-y-2">
                        {(selectedEmployee.suggestions || []).map((s, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-orange-700">
                            <span className="text-orange-600 mt-0.5">•</span>
                            <span>{s}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  </>
              )}
            </div>
          </div>
        </div>
      )}

      <MRSCard title={`Todos os Colaboradores - Visualização Gráfica (${filteredRankings.length})`} collapsible>
        <ResponsiveContainer width="100%" height={Math.max(filteredRankings.length * 50 + 50, 300)}>
          <BarChart data={chartDataWithCriteria} layout="vertical" margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" />
            <YAxis dataKey="employee_name" type="category" width={150} />
            <Tooltip formatter={(value: any) => typeof value === 'number' ? value.toFixed(2) : value} />
            <Legend />
            {criteria.map((criterion, index) => {
              const colors = ['#912325', '#f97316', '#10b981', '#ef4444', '#3b82f6', '#f97316', '#8b5cf6'];
              return (
                <Bar key={criterion.id} dataKey={criterion.name} stackId="a" fill={colors[index % colors.length]}>
                  <LabelList dataKey={criterion.name} position="inside" formatter={(value: number) => formatNumber(value, 2)} fill="#fff" fontSize={10} />
                </Bar>
              );
            })}
          </BarChart>
        </ResponsiveContainer>
      </MRSCard>
    </div>
  );
}
