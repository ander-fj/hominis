import { supabase } from '@/lib/supabase';

export interface DashboardMetrics {
  projectsActive: number; activitiesInProgress: number; activitiesCompleted: number;
  activitiesPending: number; activitiesToday: number; workOrdersOpen: number;
  expensesMonth: number; fuelMonth: number; maintenanceMonth: number;
}

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().slice(0, 10);
  const today = now.toISOString().slice(0, 10);
  const [projects, inProgress, completed, pending, todayActivities, workOrders, expenses, fuelings, maintenance] = await Promise.all([
    supabase.from('projects').select('*', { count: 'exact', head: true }).eq('status', 'em_andamento'),
    supabase.from('activities').select('*', { count: 'exact', head: true }).eq('status', 'em_andamento'),
    supabase.from('activities').select('*', { count: 'exact', head: true }).eq('status', 'concluida'),
    supabase.from('activities').select('*', { count: 'exact', head: true }).eq('status', 'planejada'),
    supabase.from('activities').select('*', { count: 'exact', head: true }).eq('planned_date', today),
    supabase.from('work_orders').select('*', { count: 'exact', head: true }),
    supabase.from('expenses').select('amount').gte('expense_date', start).lt('expense_date', end),
    supabase.from('vehicle_fuelings').select('total_amount').gte('fueling_date', start).lt('fueling_date', end),
    supabase.from('vehicle_maintenance_events').select('cost').gte('performed_at', start).lt('performed_at', end),
  ]);
  const errors = [projects,inProgress,completed,pending,todayActivities,workOrders,expenses,fuelings,maintenance].map(x=>x.error).filter(Boolean);
  if (errors.length) throw errors[0];
  const sum = (rows: Array<Record<string, unknown>> | null, key: string) => (rows ?? []).reduce((t, r) => t + Number(r[key] ?? 0), 0);
  return { projectsActive: projects.count ?? 0, activitiesInProgress: inProgress.count ?? 0, activitiesCompleted: completed.count ?? 0, activitiesPending: pending.count ?? 0, activitiesToday: todayActivities.count ?? 0, workOrdersOpen: workOrders.count ?? 0, expensesMonth: sum(expenses.data,'amount'), fuelMonth: sum(fuelings.data,'total_amount'), maintenanceMonth: sum(maintenance.data,'cost') };
}
