import { supabase } from '@/lib/supabase';

export type IntelligenceFilters = { startDate?: string; endDate?: string };
export type IntelligenceData = {
  total:number; completed:number; overdue:number; completionRate:number; slaRate:number;
  critical:number; byPriority:{label:string; total:number}[]; healthScore:number;
};

const closed = new Set(['concluida','cancelada']);

type ActivityRow = { status: string; priority: string; planned_date: string | null };

export function calculateIntelligence(rows: ActivityRow[]):IntelligenceData {
  const today = new Date().toISOString().slice(0,10);
  const total = rows.length;
  const completed = rows.filter(r=>r.status==='concluida').length;
  const overdue = rows.filter(r=>!closed.has(r.status) && r.planned_date && r.planned_date < today).length;
  const critical = rows.filter(r=>r.priority==='critica' && !closed.has(r.status)).length;
  const completionRate = total ? Math.round((completed/total)*100) : 0;
  const eligible = rows.filter(r=>r.planned_date && closed.has(r.status));
  const onTime = eligible.filter(r=>r.status==='concluida' ? true : r.status==='cancelada').length;
  const slaRate = eligible.length ? Math.round((onTime/eligible.length)*100) : completionRate;
  const priorities=['baixa','media','alta','critica'];
  const byPriority=priorities.map(label=>({label,total:rows.filter(r=>r.priority===label).length}));
  const healthScore=Math.max(0,Math.min(100,Math.round(completionRate*0.5 + slaRate*0.35 - overdue*3 - critical*4 + 15)));
  return {total,completed,overdue,completionRate,slaRate,critical,byPriority,healthScore};
}

export async function getOperationalIntelligence(filters:IntelligenceFilters):Promise<IntelligenceData>{
  let q=supabase.from('activities').select('status,priority,planned_date');
  if(filters.startDate) q=q.gte('planned_date',filters.startDate);
  if(filters.endDate) q=q.lte('planned_date',filters.endDate);
  const {data,error}=await q;
  if(error) throw error;
  return calculateIntelligence(data||[]);
}
