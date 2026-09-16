export type UserRole = 'admin' | 'gestor' | 'tecnico' | 'financeiro';

export interface Profile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  phone: string | null;
  avatar_url: string | null;
  active: boolean;
  maintenance_alert_threshold: number;
  created_at: string;
  updated_at: string;
}

export interface Client {
  id: string;
  name: string;
  document: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Team {
  id: string;
  name: string;
  leader_id: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TeamMember {
  id: string;
  team_id: string;
  user_id: string;
  created_at: string;
}

export interface Vehicle {
  id: string;
  plate: string;
  model: string;
  brand: string | null;
  year: number | null;
  color: string | null;
  fuel_type: string;
  odometer: number;
  next_oil_change_odometer: number | null;
  next_filter_change_odometer: number | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}


export interface VehicleFueling { id: string; vehicle_id: string; odometer: number; liters: number; total_amount: number; fueling_date: string; station: string | null; notes: string | null; created_at: string; }
export interface VehicleMaintenanceEvent { id: string; vehicle_id: string; type: string; description: string | null; odometer: number; cost: number; performed_at: string; next_due_odometer: number | null; next_due_date: string | null; created_at: string; }

export type ProjectStatus = 'planejada' | 'em_andamento' | 'pausada' | 'concluida' | 'cancelada';

export interface Project {
  id: string;
  code: string;
  name: string;
  client_id: string | null;
  contract: string | null;
  cost_center: string | null;
  manager_id: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  latitude: number | null;
  longitude: number | null;
  start_date: string | null;
  planned_end_date: string | null;
  actual_end_date: string | null;
  budget: number;
  status: ProjectStatus;
  description: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type WorkOrderStatus = 'aberta' | 'agendada' | 'em_deslocamento' | 'em_execucao' | 'aguardando' | 'concluida' | 'cancelada';
export type Priority = 'baixa' | 'media' | 'alta' | 'critica';

export interface WorkOrder {
  id: string;
  number: string;
  project_id: string;
  client_id: string | null;
  title: string;
  description: string | null;
  priority: Priority;
  responsible_id: string | null;
  team_id: string | null;
  planned_date: string | null;
  planned_time: string | null;
  location: string | null;
  status: WorkOrderStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type ActivityStatus = 'planejada' | 'em_deslocamento' | 'em_andamento' | 'pausada' | 'aguardando_validacao' | 'concluida' | 'cancelada';

export interface Activity {
  id: string;
  number: string;
  work_order_id: string;
  project_id: string;
  responsible_id: string | null;
  team_id: string | null;
  title: string;
  description: string | null;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  status: ActivityStatus;
  priority: Priority;
  planned_date: string | null;
  planned_time: string | null;
  started_at: string | null;
  finished_at: string | null;
  start_latitude: number | null;
  start_longitude: number | null;
  finish_latitude: number | null;
  finish_longitude: number | null;
  service_description: string | null;
  observations: string | null;
  problems: string | null;
  created_at: string;
  updated_at: string;
}

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrador',
  gestor: 'Gestor / Supervisor',
  tecnico: 'Técnico / Operador',
  financeiro: 'Financeiro',
};

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  planejada: 'Planejada',
  em_andamento: 'Em andamento',
  pausada: 'Pausada',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
};

export const PROJECT_STATUS_COLORS: Record<ProjectStatus, string> = {
  planejada: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
  em_andamento: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900',
  pausada: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900',
  concluida: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900',
  cancelada: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900',
};

export const WORK_ORDER_STATUS_LABELS: Record<WorkOrderStatus, string> = {
  aberta: 'Aberta',
  agendada: 'Agendada',
  em_deslocamento: 'Em deslocamento',
  em_execucao: 'Em execução',
  aguardando: 'Aguardando',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
};

export const WORK_ORDER_STATUS_COLORS: Record<WorkOrderStatus, string> = {
  aberta: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
  agendada: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-900',
  em_deslocamento: 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-400 dark:border-cyan-900',
  em_execucao: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900',
  aguardando: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900',
  concluida: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900',
  cancelada: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900',
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  baixa: 'Baixa',
  media: 'Média',
  alta: 'Alta',
  critica: 'Crítica',
};

export const PRIORITY_COLORS: Record<Priority, string> = {
  baixa: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  media: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-400',
  alta: 'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400',
  critica: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400',
};

export const ACTIVITY_STATUS_LABELS: Record<ActivityStatus, string> = {
  planejada: 'Planejada',
  em_deslocamento: 'Em deslocamento',
  em_andamento: 'Em andamento',
  pausada: 'Pausada',
  aguardando_validacao: 'Aguardando validação',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
};

export const ACTIVITY_STATUS_COLORS: Record<ActivityStatus, string> = {
  planejada: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
  em_deslocamento: 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-400 dark:border-cyan-900',
  em_andamento: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900',
  pausada: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900',
  aguardando_validacao: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-400 dark:border-violet-900',
  concluida: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900',
  cancelada: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900',
};
