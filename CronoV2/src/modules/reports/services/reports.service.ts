import { supabase } from '@/lib/supabase';

export type ReportFilters = { startDate?: string; endDate?: string };
export type ReportData = { activityTotal:number; activityCompleted:number; activityInProgress:number; expenseTotal:number; fuelTotal:number; maintenanceTotal:number; topExpenseCategories:{category:string; total:number}[] };

export async function getReportData(filters:ReportFilters):Promise<ReportData>{
  let aq=supabase.from('activities').select('id,status',{count:'exact',head:false});
  if(filters.startDate) aq=aq.gte('planned_date',filters.startDate);
  if(filters.endDate) aq=aq.lte('planned_date',filters.endDate);
  let eq=supabase.from('expenses').select('amount,category');
  if(filters.startDate) eq=eq.gte('expense_date',filters.startDate);
  if(filters.endDate) eq=eq.lte('expense_date',filters.endDate);
  let fq=supabase.from('vehicle_fuelings').select('total_amount');
  if(filters.startDate) fq=fq.gte('fueling_date',filters.startDate);
  if(filters.endDate) fq=fq.lte('fueling_date',filters.endDate);
  let mq=supabase.from('vehicle_maintenance_events').select('cost');
  if(filters.startDate) mq=mq.gte('performed_at',filters.startDate);
  if(filters.endDate) mq=mq.lte('performed_at',filters.endDate);
  const [a,e,f,m]=await Promise.all([aq,eq,fq,mq]);
  for(const r of [a,e,f,m]) if(r.error) throw r.error;
  const activities=a.data||[], expenses=e.data||[], fuel=f.data||[], maintenance=m.data||[];
  const categories=new Map<string,number>();
  expenses.forEach((x)=>categories.set(x.category||'Sem categoria',(categories.get(x.category||'Sem categoria')||0)+Number(x.amount||0)));
  return {activityTotal:activities.length,activityCompleted:activities.filter((x)=>x.status==='concluida').length,activityInProgress:activities.filter((x)=>['em_andamento','em_deslocamento','pausada'].includes(x.status)).length,expenseTotal:expenses.reduce((s,x)=>s+Number(x.amount||0),0),fuelTotal:fuel.reduce((s,x)=>s+Number(x.total_amount||0),0),maintenanceTotal:maintenance.reduce((s,x)=>s+Number(x.cost||0),0),topExpenseCategories:[...categories.entries()].map(([category,total])=>({category,total})).sort((a,b)=>b.total-a.total).slice(0,10)};
}
