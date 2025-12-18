import { supabase } from './supabase';
import { Database } from './database.types';

type EvaluationCriteria = Database['public']['Tables']['evaluation_criteria']['Row'];
type EmployeeScore = Database['public']['Tables']['employee_scores']['Row'];
type Employee = Database['public']['Tables']['employees']['Row'];

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

    const previousMonth = isConsolidated ? '' : getPreviousMonth(period);

    let scoresQuery = supabase.from('employee_scores').select('*');
    if (!isConsolidated) {
      scoresQuery = scoresQuery.eq('period', period);
    }

    const [criteriaResult, scoresResult, employeesResult, previousRankingsResult] = await Promise.all([
      supabase.from('evaluation_criteria').select('*').eq('active', true).order('display_order'),
      scoresQuery,
      supabase.from('employees').select('*').eq('active', true),
      isConsolidated ? Promise.resolve({ data: [], error: null }) : supabase.from('employee_rankings').select('*').eq('period', previousMonth),
    ]);

    if (criteriaResult.error) throw criteriaResult.error;
    if (scoresResult.error) throw scoresResult.error;
    if (employeesResult.error) throw employeesResult.error;

    const criteria = criteriaResult.data;
    let scores = scoresResult.data || [];
    const employees = employeesResult.data;
    const previousRankings = previousRankingsResult.data || [];

    if (!criteria || criteria.length === 0) {
      console.warn('Nenhum critério ativo encontrado');
      return [];
    }

    if (!employees || employees.length === 0) {
      console.warn('Nenhum colaborador ativo encontrado');
      return [];
    }

    const totalWeight = criteria.reduce((sum, c) => sum + c.weight, 0);
    if (Math.abs(totalWeight - 100) > 0.01) {
      console.warn(`Soma dos pesos: ${totalWeight}% (esperado: 100%)`);
    }

    let normalizedScores: Array<{ employee_id: string; criterion_id: string; raw_value: number; normalized_score: number }>;

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
          employee_id: data.employee_id,
          criterion_id: data.criterion_id,
          raw_value: sumRawValue,
          normalized_score: sumNormalizedScore,
        };
      });
      console.log('Aggregated & Summed Normalized Scores:', normalizedScores);

    } else {
      normalizedScores = normalizeAllScores(criteria, scores, employees);
      await updateNormalizedScores(normalizedScores, period);
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

    if (isConsolidated) {
      console.log('Final Rankings:', rankings);
    }

    rankings.sort((a, b) => b.total_score - a.total_score);

    rankings.forEach((ranking, index) => {
      ranking.rank_position = index + 1;

      if (!isConsolidated && previousRankings && previousRankings.length > 0) {
        const prevRank = previousRankings.find(pr => pr.employee_id === ranking.employee_id);
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
): Array<{ employee_id: string; criterion_id: string; raw_value: number; normalized_score: number }> {
  const normalized: Array<{ employee_id: string; criterion_id: string; raw_value: number; normalized_score: number }> = [];

  for (const criterion of criteria) {
    const criterionScores = scores.filter(s => s.criterion_id === criterion.id);

    if (criterionScores.length === 0) {
      employees.forEach(emp => {
        normalized.push({
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
  normalizedScores: Array<{ employee_id: string; criterion_id: string; raw_value: number; normalized_score: number }>,
  period: string
): Promise<void> {
  const updates = normalizedScores.map(score =>
    supabase
      .from('employee_scores')
      .update({ normalized_score: score.normalized_score })
      .eq('employee_id', score.employee_id)
      .eq('criterion_id', score.criterion_id)
      .eq('period', period)
  );

  const results = await Promise.all(updates);

  const errors = results.filter(r => r.error);
  if (errors.length > 0) {
    console.warn(`${errors.length} erros ao atualizar scores normalizados`);
  }
}

async function saveRankings(rankings: RankingResult[], period: string): Promise<void> {
  const rankingUpserts = rankings.map(r => ({
    employee_id: r.employee_id,
    employee_name: r.employee_name,
    photo_url: r.photo_url || null,
    period,
    total_score: r.total_score,
    rank_position: r.rank_position,
    department: r.department,
  }));

  const { error } = await supabase
    .from('employee_rankings')
    .upsert(rankingUpserts, {
      onConflict: 'employee_id,period'
    });

  if (error) throw error;
}

function getPreviousMonth(period: string): string {
  const date = new Date(period);
  date.setMonth(date.getMonth() - 1);
  return date.toISOString().split('T')[0].slice(0, 10);
}

export async function recalculateAllRankingsEngine(): Promise<void> {
  const { data: periods } = await supabase
    .from('employee_scores')
    .select('period')
    .order('period', { ascending: false });

  if (!periods) return;

  const uniquePeriods = [...new Set(periods.map(p => p.period))];

  for (const period of uniquePeriods) {
    await calculateIntelligentRanking(period);
  }
}

export async function generatePerformanceData(period: string): Promise<void> {
  if (!period || period === '') {
    throw new Error('Período é obrigatório para gerar dados de performance');
  }

  const { data: criteria, error: criteriaError } = await supabase
    .from('evaluation_criteria')
    .select('*')
    .eq('active', true);

  if (criteriaError) throw criteriaError;
  if (!criteria || criteria.length === 0) {
    throw new Error('Nenhum critério de avaliação encontrado');
  }

  const { data: employees, error: employeesError } = await supabase
    .from('employees')
    .select('*')
    .eq('active', true);

  if (employeesError) throw employeesError;
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
      const { data: existingScore } = await supabase
        .from('employee_scores')
        .select('*')
        .eq('employee_id', employee.id)
        .eq('criterion_id', criterion.id)
        .eq('period', period)
        .maybeSingle();

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

    const { error: insertError } = await supabase
      .from('employee_scores')
      .insert(scoresToInsert);

    if (insertError) throw insertError;
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

    const { data: existingScores } = await supabase
      .from('employee_scores')
      .select('id')
      .eq('period', month)
      .limit(1);

    if (!existingScores || existingScores.length === 0) {
      await generatePerformanceData(month);
      console.log(`✅ Dados gerados para ${month}`);
    } else {
      console.log(`⏭️ Dados já existem para ${month}`);
      await calculateIntelligentRanking(month);
    }
  }
}
