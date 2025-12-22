import { supabase } from './supabase';
import { Database } from './database.types';

type EvaluationCriteria = Database['public']['Tables']['evaluation_criteria']['Row'];
type EmployeeScore = Database['public']['Tables']['employee_scores']['Row'];
type Employee = Database['public']['Tables']['employees']['Row'];

export interface RankingResult {
  employee_id: string;
  employee_name: string;
  department: string;
  total_score: number;
  rank_position: number;
  criterion_scores: Array<{
    criterion_id: string;
    criterion_name: string;
    raw_value: number;
    normalized_score: number;
    weight: number;
  }>;
}

export async function calculateRankings(period: string): Promise<RankingResult[]> {
  const { data: criteria, error: criteriaError } = await supabase
    .from('evaluation_criteria')
    .select('*')
    .eq('active', true)
    .order('display_order');

  if (criteriaError) throw criteriaError;
  if (!criteria || criteria.length === 0) return [];

  const totalWeight = criteria.reduce((sum, c) => sum + c.weight, 0);
  if (Math.abs(totalWeight - 100) > 0.01) {
    console.warn(`Total weight is ${totalWeight}%, not 100%`);
  }

  const { data: scores, error: scoresError } = await supabase
    .from('employee_scores')
    .select('*')
    .eq('period', period);

  if (scoresError) throw scoresError;

  const { data: employees, error: employeesError } = await supabase
    .from('employees')
    .select('*')
    .eq('active', true);

  if (employeesError) throw employeesError;
  if (!employees || employees.length === 0) return [];

  const criteriaMap = new Map(criteria.map(c => [c.id, c]));
  const scoresMap = new Map<string, Map<string, EmployeeScore>>();

  scores?.forEach(score => {
    if (!scoresMap.has(score.employee_id)) {
      scoresMap.set(score.employee_id, new Map());
    }
    scoresMap.get(score.employee_id)!.set(score.criterion_id, score);
  });

  const normalizedScores = await normalizeScores(criteria, scores || [], employees);

  const rankings: RankingResult[] = employees.map(employee => {
    let totalScore = 0;
    const criterionScores: RankingResult['criterion_scores'] = [];

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
      });
    });

    return {
      employee_id: employee.id,
      employee_name: employee.name,
      department: employee.department,
      total_score: totalScore,
      rank_position: 0,
      criterion_scores: criterionScores,
    };
  });

  rankings.sort((a, b) => b.total_score - a.total_score);
  rankings.forEach((r, index) => {
    r.rank_position = index + 1;
  });

  await saveRankings(rankings, period);

  return rankings;
}

async function normalizeScores(
  criteria: EvaluationCriteria[],
  scores: EmployeeScore[],
  employees: Employee[]
): Promise<Array<{ employee_id: string; criterion_id: string; raw_value: number; normalized_score: number }>> {
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

async function saveRankings(rankings: RankingResult[], period: string): Promise<void> {
  const rankingInserts = rankings.map(r => ({
    employee_id: r.employee_id,
    period,
    total_score: r.total_score,
    rank_position: r.rank_position,
    department: r.department,
  }));

  await supabase.from('employee_rankings').delete().eq('period', period);

  const { error } = await supabase.from('employee_rankings').insert(rankingInserts);

  if (error) throw error;
}

export async function recalculateAllRankings(): Promise<void> {
  const { data: periods } = await supabase
    .from('employee_scores')
    .select('period')
    .order('period', { ascending: false });

  if (!periods) return;

  const uniquePeriods = [...new Set(periods.map(p => p.period))];

  for (const period of uniquePeriods) {
    await calculateRankings(period);
  }
}

export async function autoAdjustWeights(criteriaIds: string[]): Promise<void> {
  const count = criteriaIds.length;
  if (count === 0) return;

  const equalWeight = Math.floor((100 / count) * 100) / 100;
  let remaining = 100 - equalWeight * count;

  const updates = criteriaIds.map((id, index) => {
    const weight = index === 0 ? equalWeight + remaining : equalWeight;
    return { id, weight };
  });

  for (const update of updates) {
    await supabase
      .from('evaluation_criteria')
      .update({ weight: update.weight })
      .eq('id', update.id);
  }
}
