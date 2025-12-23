import { db } from './firebase';
import { collection, query, where, getDocs, doc, updateDoc, setDoc, orderBy, writeBatch, addDoc } from 'firebase/firestore';

// Types need to be defined manually or inferred since we don't have Database types from Supabase
type EvaluationCriteria = any;
type EmployeeScore = any;
type Employee = any;

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

export async function calculateIntelligentRanking(period: string, useCache: boolean = true, companyId?: string): Promise<RankingResult[]> {
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

    let scoresRef = collection(db, 'employee_scores');
    let scoresConstraints = [];
    
    if (!isConsolidated) {
      scoresConstraints.push(where('period', '==', period));
    }
    if (companyId) {
      scoresConstraints.push(where('companyId', '==', companyId));
    }
    const scoresQuery = query(scoresRef, ...scoresConstraints);

    let criteriaRef = collection(db, 'evaluation_criteria');
    let criteriaConstraints = [where('active', '==', true), orderBy('display_order')];
    if (companyId) criteriaConstraints.push(where('companyId', '==', companyId));
    const criteriaQuery = query(criteriaRef, ...criteriaConstraints);

    let employeesRef = collection(db, 'employees');
    let employeesConstraints = [where('active', '==', true)];
    if (companyId) employeesConstraints.push(where('companyId', '==', companyId));
    const employeesQuery = query(employeesRef, ...employeesConstraints);

    const prevRankingQuery = isConsolidated ? null : query(collection(db, 'employee_rankings'), where('period', '==', previousMonth));

    const [criteriaResult, scoresResult, employeesResult, previousRankingsResult] = await Promise.all([
      getDocs(criteriaQuery),
      getDocs(scoresQuery),
      getDocs(employeesQuery),
      prevRankingQuery ? getDocs(prevRankingQuery) : Promise.resolve({ docs: [] }),
    ]);

    const criteria = criteriaResult.docs.map(d => ({ id: d.id, ...d.data() })) as EvaluationCriteria[];
    let scores = scoresResult.docs.map(d => ({ id: d.id, ...d.data() })) as EmployeeScore[];
    const employees = employeesResult.docs.map(d => ({ id: d.id, ...d.data() })) as Employee[];
    const previousRankings = previousRankingsResult.docs.map(d => d.data()) as any[];

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
  const batch = writeBatch(db);
  
  // We need to find the doc IDs to update. This is inefficient in Firestore without IDs.
  // Assuming we can query them or they were loaded.
  // For now, let's query and update individually (slow but works) or use the IDs if we had them.
  // Since we don't have IDs in normalizedScores, we have to query.
  
  for (const score of normalizedScores) {
    const q = query(collection(db, 'employee_scores'), 
      where('employee_id', '==', score.employee_id),
      where('criterion_id', '==', score.criterion_id),
      where('period', '==', period)
    );
    const snapshot = await getDocs(q);
    snapshot.forEach(doc => {
      batch.update(doc.ref, { normalized_score: score.normalized_score });
    });
  }

  await batch.commit();
}

async function saveRankings(rankings: RankingResult[], period: string): Promise<void> {
  const batch = writeBatch(db);
  
  for (const r of rankings) {
    // Create a deterministic ID for upsert behavior
    const docId = `${r.employee_id}_${period}`;
    const docRef = doc(db, 'employee_rankings', docId);
    
    batch.set(docRef, {
      employee_id: r.employee_id,
      employee_name: r.employee_name,
      photo_url: r.photo_url || null,
      period,
      total_score: r.total_score,
      rank_position: r.rank_position,
      department: r.department,
      companyId: (r as any).companyId
    }, { merge: true });
  }

  await batch.commit();
}

function getPreviousMonth(period: string): string {
  const date = new Date(period);
  date.setMonth(date.getMonth() - 1);
  return date.toISOString().split('T')[0].slice(0, 10);
}

export async function recalculateAllRankingsEngine(): Promise<void> {
  const q = query(collection(db, 'employee_scores'), orderBy('period', 'desc'));
  const snapshot = await getDocs(q);
  
  if (snapshot.empty) return;

  const uniquePeriods = [...new Set(snapshot.docs.map(d => d.data().period))];

  for (const period of uniquePeriods) {
    await calculateIntelligentRanking(period as string);
  }
}

export async function generatePerformanceData(period: string, companyId?: string): Promise<void> {
  if (!period || period === '') {
    throw new Error('Período é obrigatório para gerar dados de performance');
  }

  let criteriaRef = collection(db, 'evaluation_criteria');
  let criteriaConstraints = [where('active', '==', true)];

  if (companyId) {
    criteriaConstraints.push(where('companyId', '==', companyId));
  }

  const criteriaSnapshot = await getDocs(query(criteriaRef, ...criteriaConstraints));
  const criteria = criteriaSnapshot.docs.map(d => ({ id: d.id, ...d.data() })) as EvaluationCriteria[];

  if (!criteria || criteria.length === 0) {
    throw new Error('Nenhum critério de avaliação encontrado');
  }

  let employeesRef = collection(db, 'employees');
  let employeesConstraints = [where('active', '==', true)];

  if (companyId) {
    employeesConstraints.push(where('companyId', '==', companyId));
  }

  const employeesSnapshot = await getDocs(query(employeesRef, ...employeesConstraints));
  const employees = employeesSnapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Employee[];

  if (!employees || employees.length === 0) {
    throw new Error('Nenhum colaborador encontrado');
  }

  const scoresToInsert: Array<{
    employee_id: string;
    criterion_id: string;
    period: string;
    raw_value: number;
    normalized_score: number;
    companyId?: string;
  }> = [];

  for (const employee of employees) {
    for (const criterion of criteria) {
      let scoresRef = collection(db, 'employee_scores');
      let constraints = [
        where('employee_id', '==', employee.id),
        where('criterion_id', '==', criterion.id),
        where('period', '==', period)
      ];
      
      if (companyId) {
        constraints.push(where('companyId', '==', companyId));
      }

      const existingScoreSnapshot = await getDocs(query(scoresRef, ...constraints));
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
          companyId: companyId || employee.companyId
        });
      }
    }
  }

  if (scoresToInsert.length > 0) {
    console.log(`Gerando ${scoresToInsert.length} novos registros de performance (mantendo dados existentes)`);

    const batch = writeBatch(db);
    scoresToInsert.forEach(score => {
      batch.set(doc(collection(db, 'employee_scores')), score);
    });
    await batch.commit();
  }

  await calculateIntelligentRanking(period, false, companyId);
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
    // Limit 1 is not directly available in getDocs easily without query limit, but we can just check empty
    // Actually limit(1) exists in firestore
    const snapshot = await getDocs(query(q, where('period', '==', month))); // Simplified check

    if (snapshot.empty) {
      await generatePerformanceData(month);
      console.log(`✅ Dados gerados para ${month}`);
    } else {
      console.log(`⏭️ Dados já existem para ${month}`);
      await calculateIntelligentRanking(month);
    }
  }
}

export async function seedSampleData(companyId: string, isNewUser: boolean = false): Promise<void> {
  console.log(`Seeding sample data for company: ${companyId}`);

  // 1. Check and create criteria
  const criteriaQ = query(collection(db, 'evaluation_criteria'), where('companyId', '==', companyId));
  const criteriaSnapshot = await getDocs(criteriaQ);
  const criteria = criteriaSnapshot.docs;

  if (criteria.length === 0) {
    const defaultCriteria = [
      { name: 'Assiduidade', description: 'Presença e pontualidade', weight: 30, direction: 'higher_better', metric_type: 'percentage', display_order: 1, active: true, companyId },
      { name: 'Produtividade', description: 'Volume de entregas', weight: 40, direction: 'higher_better', metric_type: 'score', display_order: 2, active: true, companyId },
      { name: 'Comportamento', description: 'Trabalho em equipe', weight: 30, direction: 'higher_better', metric_type: 'score', display_order: 3, active: true, companyId },
    ];
    const batch = writeBatch(db);
    defaultCriteria.forEach(c => {
      batch.set(doc(collection(db, 'evaluation_criteria')), c);
    });
    await batch.commit();
  }

  // 2. Check and create employees
  const employeesQ = query(collection(db, 'employees'), where('companyId', '==', companyId));
  const employeesSnapshot = await getDocs(employeesQ);
  const count = employeesSnapshot.size;

  if (count === 0) {
    const sampleEmployees = [
      { name: 'João Silva', email: `joao.silva@${companyId}.test`, department: 'Operações', position: 'Operador', active: true, companyId },
      { name: 'Maria Santos', email: `maria.santos@${companyId}.test`, department: 'Vendas', position: 'Vendedora', active: true, companyId },
      { name: 'Pedro Oliveira', email: `pedro.oliveira@${companyId}.test`, department: 'TI', position: 'Desenvolvedor', active: true, companyId },
      { name: 'Ana Costa', email: `ana.costa@${companyId}.test`, department: 'RH', position: 'Analista', active: true, companyId },
      { name: 'Carlos Souza', email: `carlos.souza@${companyId}.test`, department: 'Operações', position: 'Supervisor', active: true, companyId },
    ];
    const batch = writeBatch(db);
    sampleEmployees.forEach(e => {
      batch.set(doc(collection(db, 'employees')), e);
    });
    await batch.commit();
  }

  // 3. Generate scores
  const currentPeriod = new Date().toISOString().slice(0, 7) + '-01';
  await generatePerformanceData(currentPeriod, companyId);
}
