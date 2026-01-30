import { db } from './firebase';
import { collection, getDocs, query, where, writeBatch, doc, setDoc, orderBy } from 'firebase/firestore';
import { format } from 'date-fns';
interface EvaluationCriteria {
  id: string;
  name: string;
  weight: number;
  direction: 'higher_better' | 'lower_better';
  metric_type?: string;
}

interface EmployeeScore {
  id: string; employee_id: string; criterion_id: string; period: string; raw_value: number; normalized_score: number | null;
}

interface Employee {
  id: string; name: string; email: string; department: string; position: string; photo_url?: string; active: boolean;
}

export interface CriterionScore {
  criterion_id: string;
  criterion_name: string;
  raw_value: number;
  normalized_score: number;
  weight: number;
  weighted_score: number;
}

export interface RankingResult {
  employee_id: string;
  employee_name: string;
  employee_email: string;
  department: string;
  position: string;
  photo_url?: string;
  total_score: number;
  rank_position: number;
  previous_rank?: number;
  rank_variation?: number;
  criterion_scores: CriterionScore[];
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  absences_count?: number;
  late_count?: number;
}

const rankingCache = new Map<string, { data: RankingResult[], timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000;

export function clearRankingCache() {
  rankingCache.clear();
  console.log('Cache de ranking limpo');
}

export async function calculateIntelligentRanking(period: string, useCache: boolean = true): Promise<RankingResult[]> {
  try {
    if (!period || period === '') {
      console.error('Período vazio fornecido para calculateIntelligentRanking');
      return [];
    }

    const isConsolidated = period === 'consolidated';

    if (useCache && !isConsolidated) {
      const cached = rankingCache.get(period);
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        console.log('Usando dados em cache');
        return cached.data;
      }
    }

    console.log(`Buscando dados do Firestore para o período: ${period}`);

    const previousMonth = isConsolidated ? '' : getPreviousMonth(period);

    let scoresFirestoreQuery = collection(db, 'employee_scores');
    if (!isConsolidated) {
      scoresFirestoreQuery = query(scoresFirestoreQuery, where('period', '==', period));
    }

    // Firebase queries
    const [criteriaResult, scoresResult, employeesResult, previousRankingsResult] = await Promise.all([
      getDocs(query(collection(db, 'evaluation_criteria'), where('active', '==', true))),
      getDocs(scoresFirestoreQuery),
      getDocs(query(collection(db, 'employees'), where('active', '==', true))),
      isConsolidated
        ? Promise.resolve({ docs: [] }) as Promise<any> // Mock empty snapshot for consolidated
        : getDocs(query(collection(db, 'employee_rankings'), where('period', '==', previousMonth))),
    ]);

    const criteria = (criteriaResult.docs.map(doc => ({ id: doc.id, ...doc.data() })) as EvaluationCriteria[])
      .sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
      
    let scores = scoresResult.docs.map(doc => ({ id: doc.id, ...doc.data() })) as EmployeeScore[];
    const employees = employeesResult.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Employee[];
    const previousRankings = previousRankingsResult.docs.map(doc => ({ id: doc.id, ...doc.data() })) as RankingResult[];

    if (!criteria || criteria.length === 0) {
      console.warn('Nenhum critério ativo encontrado');
      return [];
    }

    // Para o caso consolidado, precisamos buscar todos os scores e filtrar pelo período
    if (isConsolidated) {
      const allScoresSnapshot = await getDocs(collection(db, 'employee_scores'));
      scores = allScoresSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as EmployeeScore[];
    }

    if (!employees || employees.length === 0) {
      console.warn('Nenhum colaborador ativo encontrado. Retornando ranking vazio.');
      // Se não há colaboradores, garante que o ranking do período seja limpo
      if (!isConsolidated) {
        await saveRankings([], period);
      }
      return [];
    }

    // Filtrar scores para o período atual se não for consolidado
    if (!isConsolidated) {
      scores = scores.filter(s => s.period === period);
    }


    const totalWeight = criteria.reduce((sum, c) => sum + c.weight, 0);
    if (Math.abs(totalWeight - 100) > 0.01) {
      console.warn(`Soma dos pesos: ${totalWeight}% (esperado: 100%)`);
    }

    let normalizedScores: Array<{ docId: string | null; employee_id: string; criterion_id: string; raw_value: number; normalized_score: number }>;

    if (isConsolidated) {
      const scoreGroups = new Map<string, { raw_values: number[], normalized_scores: number[], employee_id: string, criterion_id: string }>();

      for (const score of scores) {
        const key = `${score.employee_id}-${score.criterion_id}`;
        if (!scoreGroups.has(key)) {
          scoreGroups.set(key, { raw_values: [], normalized_scores: [], employee_id: score.employee_id, criterion_id: score.criterion_id });
        }
        scoreGroups.get(key)!.raw_values.push(score.raw_value);
        if (score.normalized_score !== null) {
          scoreGroups.get(key)!.normalized_scores.push(score.normalized_score);
        }
      }

      normalizedScores = Array.from(scoreGroups.values()).map(data => {
        const sumRawValue = data.raw_values.reduce((a, b) => a + b, 0);
        const sumNormalizedScore = data.normalized_scores.reduce((a, b) => a + b, 0);
        
        return {
          docId: null, // Not applicable for consolidated view
          employee_id: data.employee_id,
          criterion_id: data.criterion_id,
          raw_value: sumRawValue,
          normalized_score: sumNormalizedScore,
        };
      });

    } else {
      normalizedScores = normalizeAllScores(criteria, scores, employees);
      await updateNormalizedScores(normalizedScores);
    }

    const rankings: RankingResult[] = employees.map(employee => {
      let totalScore = 0;
      const criterionScores: CriterionScore[] = [];

      criteria.forEach(criterion => {
        const scoreEntry = normalizedScores.find(
          ns => ns.employee_id === employee.id && ns.criterion_id === criterion.id
        );

        const normalizedScore = scoreEntry?.normalized_score || 0;
        const rawValue = scoreEntry?.raw_value || 0;
        const weightedScore = (normalizedScore * criterion.weight) / 100;

        totalScore += weightedScore;
        criterionScores.push({
          criterion_id: criterion.id,
          criterion_name: criterion.name,
          raw_value: rawValue,
          normalized_score: normalizedScore,
          weight: criterion.weight,
          weighted_score: weightedScore,
        });
      });

      const analysis = analyzePerformance(criterionScores, criteria);

      return {
        employee_id: employee.id,
        employee_name: employee.name,
        employee_email: employee.email,
        department: employee.department,
        position: employee.position,
        photo_url: employee.photo_url,
        total_score: Math.round(totalScore * 100) / 100,
        rank_position: 0,
        criterion_scores: criterionScores,
        strengths: analysis.strengths,
        weaknesses: analysis.weaknesses,
        suggestions: analysis.suggestions,
      };
    });

    rankings.sort((a, b) => b.total_score - a.total_score);

    rankings.forEach((ranking, index) => {
      ranking.rank_position = index + 1;

      if (!isConsolidated && previousRankings && previousRankings.length > 0) {
        const prevRank = previousRankings.find(pr => pr.employee_id === ranking.employee_id && pr.period === previousMonth);
        if (prevRank) {
          ranking.previous_rank = prevRank.rank_position;
          ranking.rank_variation = prevRank.rank_position - ranking.rank_position;
        }
      }
    });

    if (!isConsolidated) {
      await saveRankings(rankings, period);
      rankingCache.set(period, { data: rankings, timestamp: Date.now() });
    }

    return rankings;
  } catch (error) {
    console.error('Erro em calculateIntelligentRanking:', error);
    throw error;
  }
}

function normalizeAllScores(
  criteria: EvaluationCriteria[],
  scores: EmployeeScore[],
  employees: Employee[]
): Array<{ docId: string | null; employee_id: string; criterion_id: string; raw_value: number; normalized_score: number }> {
  const normalized: Array<{ docId: string | null; employee_id: string; criterion_id: string; raw_value: number; normalized_score: number }> = [];

  for (const criterion of criteria) {
    const criterionScores = scores.filter(s => s.criterion_id === criterion.id);

    if (criterionScores.length === 0) {
      employees.forEach(emp => {
        normalized.push({
          docId: null,
          employee_id: emp.id,
          criterion_id: criterion.id,
          raw_value: 0,
          normalized_score: 0,
        });
      });
      continue;
    }

    const values = criterionScores.map(s => s.raw_value);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const range = maxValue - minValue;

    criterionScores.forEach(score => {
      let normalizedScore = 0;

      if (range === 0) {
        normalizedScore = 50;
      } else {
        if (criterion.direction === 'higher_better') {
          normalizedScore = ((score.raw_value - minValue) / range) * 100;
        } else {
          normalizedScore = ((maxValue - score.raw_value) / range) * 100;
        }
      }

      normalizedScore = Math.max(0, Math.min(100, normalizedScore));

      normalized.push({
        docId: score.id,
        employee_id: score.employee_id,
        criterion_id: criterion.id,
        raw_value: score.raw_value,
        normalized_score: Math.round(normalizedScore * 100) / 100,
      });
    });

    employees.forEach(emp => {
      const hasScore = criterionScores.some(s => s.employee_id === emp.id);
      if (!hasScore) {
        normalized.push({
          docId: null,
          employee_id: emp.id,
          criterion_id: criterion.id,
          raw_value: 0,
          normalized_score: 0,
        });
      }
    });
  }

  return normalized;
}

function analyzePerformance(
  scores: CriterionScore[],
  criteria: EvaluationCriteria[]
): { strengths: string[]; weaknesses: string[]; suggestions: string[] } {
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const suggestions: string[] = [];

  scores.forEach(score => {
    if (score.normalized_score >= 80) {
      strengths.push(score.criterion_name);
    } else if (score.normalized_score < 50) {
      weaknesses.push(score.criterion_name);

      const criterion = criteria.find(c => c.id === score.criterion_id);
      if (criterion) {
        suggestions.push(generateSuggestion(criterion));
      }
    }
  });

  if (suggestions.length === 0) {
    suggestions.push('Continue mantendo seu excelente desempenho!');
  }

  return { strengths, weaknesses, suggestions };
}

function generateSuggestion(criterion: EvaluationCriteria): string {
  const suggestions: Record<string, string> = {
    'Assiduidade': 'Reduza suas faltas para melhorar sua pontuação',
    'Pontualidade': 'Evite atrasos para aumentar sua avaliação',
    'Horas Trabalhadas': 'Cumpra sua carga horária completa',
    'Atestados válidos': 'Entregue seus atestados corretamente',
    'Treinamentos': 'Participe de mais cursos e treinamentos',
    'Colaboração': 'Melhore a interação com sua equipe',
  };

  return suggestions[criterion.name] || `Melhore seu desempenho em: ${criterion.name}`;
}

async function updateNormalizedScores(
  normalizedScores: Array<{ docId: string | null; employee_id: string; criterion_id: string; raw_value: number; normalized_score: number }>
): Promise<void> {
  const batch = writeBatch(db);
  for (const score of normalizedScores) {
    // Apenas atualiza se o docId existir (ou seja, o score já existia no banco)
    if (score.docId) {
      const docRef = doc(db, 'employee_scores', score.docId);
      batch.update(docRef, { normalized_score: score.normalized_score });
    }
  }
  await batch.commit();
}

async function saveRankings(rankings: RankingResult[], period: string): Promise<void> {
  // 1. Remover rankings anteriores do período para garantir limpeza
  const q = query(collection(db, 'employee_rankings'), where('period', '==', period));
  const snapshot = await getDocs(q);

  if (!snapshot.empty) {
    const deleteBatchSize = 400;
    const chunks = [];
    for (let i = 0; i < snapshot.docs.length; i += deleteBatchSize) {
      chunks.push(snapshot.docs.slice(i, i + deleteBatchSize));
    }

    for (const chunk of chunks) {
      const batch = writeBatch(db);
      chunk.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
    }
  }

  // 2. Salvar novos rankings (se houver)
  if (rankings.length === 0) return;

  const rankingUpserts = rankings.map(r => ({
    employee_id: r.employee_id,
    employee_name: r.employee_name,
    photo_url: r.photo_url || null,
    period,
    total_score: r.total_score,
    rank_position: r.rank_position,
    department: r.department,
    criterion_scores: r.criterion_scores,
    strengths: r.strengths,
    weaknesses: r.weaknesses,
    suggestions: r.suggestions,
  }));

  const insertBatchSize = 400;
  const insertChunks = [];
  for (let i = 0; i < rankingUpserts.length; i += insertBatchSize) {
    insertChunks.push(rankingUpserts.slice(i, i + insertBatchSize));
  }

  for (const chunk of insertChunks) {
    const batch = writeBatch(db);
    for (const ranking of chunk) {
      const docId = `${ranking.employee_id}_${period}`;
      const docRef = doc(db, 'employee_rankings', docId);
      batch.set(docRef, ranking, { merge: true });
    }
    await batch.commit();
  }
}

function getPreviousMonth(period: string): string {
  // Assume period is in 'YYYY-MM-DD' format (e.g., '2025-01-01')
  const [year, month] = period.split('-').map(Number);
  const prevMonthDate = new Date(year, month - 2, 1); // month - 2 because month is 1-indexed, and we want previous
  return format(prevMonthDate, 'yyyy-MM-dd');
}

export async function recalculateAllRankingsEngine(): Promise<void> {
  const scoresSnapshot = await getDocs(query(collection(db, 'employee_scores'), orderBy('period', 'desc'))); // Order by period to get latest first
  const allPeriods = scoresSnapshot.docs.map(doc => doc.data().period as string);
  if (!allPeriods || allPeriods.length === 0) {
    console.warn('Nenhum score encontrado para recalcular períodos.');
    return;
  }
  const uniquePeriods = [...new Set(allPeriods)];

  for (const period of uniquePeriods) {
    await calculateIntelligentRanking(period);
  }
}

export async function generatePerformanceData(period: string): Promise<void> {
  if (!period || period === '') {
    throw new Error('Período é obrigatório para gerar dados de performance');
  }

  const criteriaSnapshot = await getDocs(query(collection(db, 'evaluation_criteria'), where('active', '==', true)));
  const criteria = criteriaSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as EvaluationCriteria[];
  if (!criteria || criteria.length === 0) {
    throw new Error('Nenhum critério de avaliação encontrado');
  }

  const employeesSnapshot = await getDocs(query(collection(db, 'employees'), where('active', '==', true)));
  const employees = employeesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Employee[];
  if (!employees || employees.length === 0) {
    throw new Error('Nenhum colaborador encontrado');
  }

  const scoresToInsert: Array<{
    employee_id: string;
    criterion_id: string;
    period: string;
    raw_value: number;
    normalized_score: number;
  }> = [];

  for (const employee of employees) {
    for (const criterion of criteria) {
      const q = query(
        collection(db, 'employee_scores'),
        where('employee_id', '==', employee.id),
        where('criterion_id', '==', criterion.id),
        where('period', '==', period)
      );
      const existingScoreSnapshot = await getDocs(q); // Check for existing score
      const existingScore = !existingScoreSnapshot.empty;

      if (!existingScore) {
        let rawValue = 0;

        switch (criterion.metric_type) {
          case 'percentage':
            rawValue = Math.random() * 100;
            break;
          case 'count':
            rawValue = Math.floor(Math.random() * 10);
            break;
          case 'hours':
            rawValue = 160 + (Math.random() * 40 - 20);
            break;
          case 'score':
            rawValue = 50 + Math.random() * 50;
            break;
          default:
            rawValue = Math.random() * 100;
        }

        rawValue = Math.round(rawValue * 100) / 100;

        scoresToInsert.push({
          employee_id: employee.id,
          criterion_id: criterion.id,
          period,
          raw_value: rawValue,
          normalized_score: 0,
        });
      }
    }
  }

  if (scoresToInsert.length > 0) {
    console.log(`Gerando ${scoresToInsert.length} novos registros de performance (mantendo dados existentes)`);

    const batch = writeBatch(db);
    scoresToInsert.forEach(score => {
      const docRef = doc(collection(db, 'employee_scores')); // Let Firestore generate ID
      batch.set(docRef, score);
    });
    await batch.commit();
  }

  await calculateIntelligentRanking(period);
}

export async function generateHistoricalData(): Promise<void> {
  const months = [
    '2025-05-01',
    '2025-06-01',
    '2025-07-01',
    '2025-08-01',
    '2025-09-01',
    '2025-10-01',
  ];

  for (const month of months) {
    console.log(`Gerando dados para ${month}...`);

    const q = query(collection(db, 'employee_scores'), where('period', '==', month));
    const existingScoresSnapshot = await getDocs(q);
    const existingScores = !existingScoresSnapshot.empty;
    if (!existingScores || existingScores.length === 0) {
      await generatePerformanceData(month);
      console.log(`✅ Dados gerados para ${month}`);
    } else {
      console.log(`⏭️ Dados já existem para ${month}`);
      await calculateIntelligentRanking(month);
    }
  }
}
