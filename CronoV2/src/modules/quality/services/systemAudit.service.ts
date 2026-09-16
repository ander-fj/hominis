import { supabase } from '@/lib/supabase';

export interface SystemAuditResult {
  label: string;
  value: number;
  severity: 'ok' | 'warning' | 'critical';
  detail: string;
}

export async function runSystemAudit(): Promise<SystemAuditResult[]> {
  const [overdue, failedRuns, unreadNotifications] = await Promise.all([
    supabase.from('activities').select('*', { count: 'exact', head: true }).lt('planned_date', new Date().toISOString().slice(0, 10)).not('status', 'in', '(concluida,cancelada)'),
    supabase.from('automation_runs').select('*', { count: 'exact', head: true }).eq('status', 'FAILED'),
    supabase.from('notifications').select('*', { count: 'exact', head: true }).is('read_at', null),
  ]);
  const errors = [overdue.error, failedRuns.error, unreadNotifications.error].filter(Boolean);
  if (errors.length) throw errors[0];
  const overdueCount = overdue.count ?? 0;
  const failedCount = failedRuns.count ?? 0;
  const unreadCount = unreadNotifications.count ?? 0;
  return [
    { label: 'Atividades atrasadas', value: overdueCount, severity: overdueCount > 10 ? 'critical' : overdueCount > 0 ? 'warning' : 'ok', detail: 'Atividades abertas com data planejada vencida.' },
    { label: 'Falhas de automação', value: failedCount, severity: failedCount > 0 ? 'critical' : 'ok', detail: 'Execuções registradas com status de erro.' },
    { label: 'Notificações pendentes', value: unreadCount, severity: unreadCount > 20 ? 'warning' : 'ok', detail: 'Notificações ainda não visualizadas.' },
  ];
}
