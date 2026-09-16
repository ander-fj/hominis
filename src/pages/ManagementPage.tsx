import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, Badge, Spinner, Select, Modal } from '@/components/ui';
import { ActivityMap } from '@/components/ActivityMap';
import { ActivityDetailModal } from '@/components/ActivityDetailModal';
import { useAuth } from '@/context/AuthContext';
import {
  ACTIVITY_STATUS_LABELS,
  ACTIVITY_STATUS_COLORS,
  ROLE_LABELS,
  PROJECT_STATUS_LABELS,
  type ProjectStatus,
  type Profile,
  type Activity,
  type Project,
} from '@/types';
import { formatCurrency, formatDate, initials } from '@/lib/utils';
import {
  Fuel, UtensilsCrossed, Truck, Wallet, Calendar, Bell, ChevronDown,
  ChevronRight, ArrowUp, ArrowDown, Minus, Mail, Phone, Zap, MapPin, ClipboardList,
  AlertTriangle, SlidersHorizontal, HardHat, type LucideIcon,
} from 'lucide-react';
import type { PageKey } from '@/components/Layout';

interface ActivityWithRelations extends Activity {
  project: Project | null;
  responsible: Profile | null;
}

interface RecordWithActivity {
  id: string;
  type: string;
  amount: number;
  description: string;
  created_at: string;
  activity: { id: string; title: string; project: { name: string } | null } | null;
}

type PeriodKey = 'today' | '7d' | '30d' | 'month' | 'all';

type CostBreakdown = { combustivel: number; refeicao: number; deslocamento: number; material: number; outro: number };

const PERIOD_OPTIONS: { value: PeriodKey; label: string }[] = [
  { value: 'today', label: 'Hoje' },
  { value: '7d', label: 'Últimos 7 dias' },
  { value: '30d', label: 'Últimos 30 dias' },
  { value: 'month', label: 'Este mês' },
  { value: 'all', label: 'Tudo' },
];

function periodRange(period: PeriodKey): { start: Date | null; end: Date } {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  switch (period) {
    case 'today': {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      return { start, end };
    }
    case '7d': {
      const start = new Date(now);
      start.setDate(start.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      return { start, end };
    }
    case '30d': {
      const start = new Date(now);
      start.setDate(start.getDate() - 29);
      start.setHours(0, 0, 0, 0);
      return { start, end };
    }
    case 'month': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start, end };
    }
    case 'all':
    default:
      return { start: null, end };
  }
}

function previousWindow(start: Date | null, end: Date): { start: Date; end: Date } | null {
  if (!start) return null;
  const length = end.getTime() - start.getTime();
  const prevEnd = new Date(start.getTime() - 1);
  return { start: new Date(prevEnd.getTime() - length), end: prevEnd };
}

function emptyCosts(): CostBreakdown {
  return { combustivel: 0, refeicao: 0, deslocamento: 0, material: 0, outro: 0 };
}

function isLate(a: Activity): boolean {
  if (a.status === 'concluida' || a.status === 'cancelada') return false;
  if (!a.planned_date) return false;
  const planned = new Date(a.planned_date);
  planned.setHours(23, 59, 59, 999);
  return planned < new Date();
}

function daysLate(a: Activity): number {
  if (!a.planned_date) return 0;
  const planned = new Date(a.planned_date);
  planned.setHours(0, 0, 0, 0);
  const diff = Math.floor((Date.now() - planned.getTime()) / 86400000);
  return Math.max(0, diff);
}

function formatDateBR(date: string | null): string {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

function formatCompactCurrency(value: number): string {
  if (value >= 1000) {
    return `R$ ${(value / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`;
  }
  return `R$ ${value.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;
}

const STATUS_META: { key: 'concluidas' | 'atrasadas' | 'agendadas' | 'pendentes'; label: string; color: string }[] = [
  { key: 'concluidas', label: 'Concluídas', color: '#10b981' },
  { key: 'atrasadas', label: 'Atrasadas', color: '#ef4444' },
  { key: 'agendadas', label: 'Agendadas', color: '#3b82f6' },
  { key: 'pendentes', label: 'Pendentes', color: '#f59e0b' },
];

const PROJECT_STATUS_DOT: Record<ProjectStatus, string> = {
  planejada: '#94a3b8',
  em_andamento: '#3b82f6',
  pausada: '#f59e0b',
  concluida: '#10b981',
  cancelada: '#ef4444',
};


export function ManagementPage({
  onOpenActivity,
  onNavigate,
}: {
  onOpenActivity?: (id: string) => void;
  onNavigate?: (page: PageKey) => void;
}) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState<ActivityWithRelations[]>([]);
  const [collaborators, setCollaborators] = useState<Profile[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [records, setRecords] = useState<RecordWithActivity[]>([]);
  const [period, setPeriod] = useState<PeriodKey>('30d');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [projectFilter, setProjectFilter] = useState('');
  const [collabFilter, setCollabFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [alertModal, setAlertModal] = useState<null | 'late' | 'noEvidence'>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<ActivityWithRelations | null>(null);

  const displayProfile = useMemo(() => {
    if (collabFilter) {
      return collaborators.find((c) => c.id === collabFilter) ?? profile;
    }
    return profile;
  }, [collabFilter, collaborators, profile]);

  // "Todos" selecionado no filtro Colaborador => visão consolidada (sem perfil específico)
  const isConsolidated = !collabFilter;

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [actRes, profRes, projRes, recRes] = await Promise.all([
        supabase
          .from('activities')
          .select('*, project:projects(*), responsible:profiles!activities_responsible_id_fkey(*)')
          .order('created_at', { ascending: false }),
        supabase.from('profiles').select('*').order('name'),
        supabase.from('projects').select('*').order('name'),
        supabase
          .from('activity_records')
          .select('id, type, amount, description, created_at, activity:activities(id, title, project:projects(name))')
          .order('created_at', { ascending: false }),
      ]);

      setActivities((actRes.data as ActivityWithRelations[]) ?? []);
      setCollaborators((profRes.data as Profile[]) ?? []);
      setProjects((projRes.data as Project[]) ?? []);
      setRecords((recRes.data as unknown as RecordWithActivity[]) ?? []);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    let active = true;
    const path = displayProfile?.avatar_url;
    if (!path) {
      setAvatarUrl(null);
      return;
    }
    supabase.storage.from('avatars').createSignedUrl(path, 3600).then(({ data }) => {
      if (active) setAvatarUrl(data?.signedUrl ?? null);
    });
    return () => {
      active = false;
    };
  }, [displayProfile?.avatar_url]);

  const { start, end } = useMemo(() => periodRange(period), [period]);
  const prevWindow = useMemo(() => previousWindow(start, end), [start, end]);

  const filteredActivities = useMemo(() => {
    return activities.filter((a) => {
      if (start && a.created_at && new Date(a.created_at) < start) return false;
      if (end && a.created_at && new Date(a.created_at) > end) return false;
      if (projectFilter && a.project_id !== projectFilter) return false;
      if (collabFilter && a.responsible_id !== collabFilter) return false;
      if (statusFilter) {
        if (statusFilter === 'atrasada') {
          if (!isLate(a)) return false;
        } else if (a.status !== statusFilter) {
          return false;
        }
      }
      return true;
    });
  }, [activities, start, end, projectFilter, collabFilter, statusFilter]);

  const activityIndex = useMemo(() => {
    const map = new Map<string, ActivityWithRelations>();
    for (const a of activities) map.set(a.id, a);
    return map;
  }, [activities]);

  const ownActivities = useMemo(() => {
    if (!collabFilter) return [];
    return activities.filter((a) => {
      if (a.responsible_id !== collabFilter) return false;
      if (start && a.created_at && new Date(a.created_at) < start) return false;
      if (end && a.created_at && new Date(a.created_at) > end) return false;
      if (projectFilter && a.project_id !== projectFilter) return false;
      return true;
    });
  }, [activities, collabFilter, start, end, projectFilter]);

  const ownCompleted = useMemo(() => ownActivities.filter((a) => a.status === 'concluida').length, [ownActivities]);

  const ownTotalCost = useMemo(() => {
    let total = 0;
    for (const r of records) {
      if (start && r.created_at && new Date(r.created_at) < start) continue;
      if (end && r.created_at && new Date(r.created_at) > end) continue;
      const act = r.activity?.id ? activityIndex.get(r.activity.id) : undefined;
      if (!act || act.responsible_id !== collabFilter) continue;
      if (projectFilter && act.project_id !== projectFilter) continue;
      total += Number(r.amount) || 0;
    }
    return total;
  }, [records, start, end, projectFilter, collabFilter, activityIndex]);

  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      if (start && r.created_at && new Date(r.created_at) < start) return false;
      if (end && r.created_at && new Date(r.created_at) > end) return false;
      const act = r.activity?.id ? activityIndex.get(r.activity.id) : undefined;
      if (projectFilter && act?.project_id !== projectFilter) return false;
      if (collabFilter && act?.responsible_id !== collabFilter) return false;
      return true;
    });
  }, [records, start, end, projectFilter, collabFilter, activityIndex]);

  const costs = useMemo(() => {
    const acc = emptyCosts();
    for (const r of filteredRecords) {
      const amount = Number(r.amount) || 0;
      if (r.type in acc) acc[r.type as keyof CostBreakdown] += amount;
      else acc.outro += amount;
    }
    return acc;
  }, [filteredRecords]);

  const prevCosts = useMemo(() => {
    const acc = emptyCosts();
    if (!prevWindow) return acc;
    for (const r of records) {
      const d = new Date(r.created_at);
      if (d < prevWindow.start || d > prevWindow.end) continue;
      const act = r.activity?.id ? activityIndex.get(r.activity.id) : undefined;
      if (projectFilter && act?.project_id !== projectFilter) continue;
      if (collabFilter && act?.responsible_id !== collabFilter) continue;
      const amount = Number(r.amount) || 0;
      if (r.type in acc) acc[r.type as keyof CostBreakdown] += amount;
      else acc.outro += amount;
    }
    return acc;
  }, [records, prevWindow, projectFilter, collabFilter, activityIndex]);

  const totalCost = costs.combustivel + costs.refeicao + costs.deslocamento + costs.material + costs.outro;

  const totalKm = useMemo(() => {
    return filteredRecords.reduce((sum, r) => {
      if (r.type === 'deslocamento') {
        const match = r.description?.match(/(\d+)\s*km/i);
        return sum + (match ? parseInt(match[1]) : 0);
      }
      return sum;
    }, 0);
  }, [filteredRecords]);

  const completedCount = useMemo(() => filteredActivities.filter((a) => a.status === 'concluida').length, [filteredActivities]);

  const cardCompleted = collabFilter ? ownCompleted : completedCount;
  const cardTotalCost = collabFilter ? ownTotalCost : totalCost;

  // Obras nas quais o colaborador exibido está alocado: é responsável pela obra
  // OU possui atividades atribuídas naquela obra.
  const allocatedProjects = useMemo(() => {
    if (!displayProfile) return [];
    const map = new Map<string, Project>();
    for (const p of projects) {
      if (p.manager_id === displayProfile.id) map.set(p.id, p);
    }
    for (const a of activities) {
      if (a.responsible_id === displayProfile.id && a.project) {
        map.set(a.project.id, a.project);
      }
    }
    return [...map.values()];
  }, [displayProfile, projects, activities]);

  const statusCounts = useMemo(() => {
    const counts = { concluidas: 0, atrasadas: 0, agendadas: 0, pendentes: 0 };
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (const a of filteredActivities) {
      if (a.status === 'concluida') { counts.concluidas++; continue; }
      if (a.status === 'cancelada') continue;
      if (isLate(a)) { counts.atrasadas++; continue; }
      if (a.planned_date && new Date(a.planned_date) >= today) counts.agendadas++;
      else counts.pendentes++;
    }
    return counts;
  }, [filteredActivities]);
  const completionRate = filteredActivities.length > 0 ? Math.round((completedCount / filteredActivities.length) * 100) : 0;
  const lateActivities = useMemo(() => filteredActivities.filter(isLate).sort((a, b) => daysLate(b) - daysLate(a)), [filteredActivities]);

  const activitiesWithoutEvidence = useMemo(() => {
    return filteredActivities.filter((a) => {
      if (a.status !== 'concluida') return false;
      return !records.some((r) => (r.type === 'evidencia' || r.type === 'foto') && (r.activity as { id?: string } | null)?.id === a.id);
    });
  }, [filteredActivities, records]);

  const alertCount = lateActivities.length + activitiesWithoutEvidence.length;
  const activeFilterCount = [collabFilter, projectFilter, statusFilter].filter(Boolean).length;


  const costByActivity = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of filteredRecords) {
      const id = (r.activity as { id?: string } | null)?.id;
      if (!id) continue;
      map.set(id, (map.get(id) ?? 0) + (Number(r.amount) || 0));
    }
    return map;
  }, [filteredRecords]);

  const topExpenseActivity = useMemo(() => {
    let best: { title: string; amount: number } | null = null;
    for (const [id, amount] of costByActivity) {
      if (!best || amount > best.amount) {
        const act = activityIndex.get(id);
        best = { title: act?.title ?? 'Sem título', amount };
      }
    }
    return best;
  }, [costByActivity, activityIndex]);

  const activeDays = useMemo(() => {
    const days = new Set<string>();
    for (const r of filteredRecords) days.add(r.created_at.slice(0, 10));
    for (const a of filteredActivities) {
      if (a.planned_date) days.add(a.planned_date.slice(0, 10));
      else if (a.created_at) days.add(a.created_at.slice(0, 10));
    }
    return days.size;
  }, [filteredRecords, filteredActivities]);

  const trend = useMemo(() => {
    const buckets: { label: string; value: number; start: Date; end: Date }[] = [];

    if (start) {
      const dayCount = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000));
      if (dayCount <= 2) {
        for (let h = 0; h < 24; h++) {
          const bStart = new Date(start);
          bStart.setHours(h, 0, 0, 0);
          const bEnd = new Date(start);
          bEnd.setHours(h, 59, 59, 999);
          buckets.push({ label: `${String(h).padStart(2, '0')}h`, value: 0, start: bStart, end: bEnd });
        }
      } else if (dayCount <= 45) {
        for (let i = 0; i < dayCount; i++) {
          const bStart = new Date(start);
          bStart.setDate(bStart.getDate() + i);
          bStart.setHours(0, 0, 0, 0);
          const bEnd = new Date(bStart);
          bEnd.setHours(23, 59, 59, 999);
          buckets.push({ label: `${String(bStart.getDate()).padStart(2, '0')}/${String(bStart.getMonth() + 1).padStart(2, '0')}`, value: 0, start: bStart, end: bEnd });
        }
      } else {
        const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
        const last = new Date(end.getFullYear(), end.getMonth(), 1);
        while (cursor <= last) {
          const bStart = new Date(cursor);
          const bEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0, 23, 59, 59, 999);
          buckets.push({ label: `${String(bStart.getMonth() + 1).padStart(2, '0')}/${String(bStart.getFullYear()).slice(2)}`, value: 0, start: bStart, end: bEnd });
          cursor.setMonth(cursor.getMonth() + 1);
        }
      }
    } else {
      for (let i = 29; i >= 0; i--) {
        const bStart = new Date();
        bStart.setDate(bStart.getDate() - i);
        bStart.setHours(0, 0, 0, 0);
        const bEnd = new Date(bStart);
        bEnd.setHours(23, 59, 59, 999);
        buckets.push({ label: `${String(bStart.getDate()).padStart(2, '0')}/${String(bStart.getMonth() + 1).padStart(2, '0')}`, value: 0, start: bStart, end: bEnd });
      }
    }

    for (const r of filteredRecords) {
      const d = new Date(r.created_at);
      const bucket = buckets.find((b) => d >= b.start && d <= b.end);
      if (bucket) bucket.value += Number(r.amount) || 0;
    }
    return buckets;
  }, [filteredRecords, start, end]);

  const kpis: { label: string; value: number; prev: number; icon: LucideIcon; chip: string }[] = [
    { label: 'Gastos com Combustível', value: costs.combustivel, prev: prevCosts.combustivel, icon: Fuel, chip: 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400' },
    { label: 'Gastos com Refeição', value: costs.refeicao, prev: prevCosts.refeicao, icon: UtensilsCrossed, chip: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400' },
    { label: 'Gastos com Deslocamento', value: costs.deslocamento, prev: prevCosts.deslocamento, icon: Truck, chip: 'bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400' },
    { label: 'Total de Gastos', value: totalCost, prev: prevCosts.combustivel + prevCosts.refeicao + prevCosts.deslocamento + prevCosts.material + prevCosts.outro, icon: Wallet, chip: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400' },
  ];

  const recentActivities = useMemo(() => {
    return [...filteredActivities]
      .sort((a, b) => {
        const da = a.planned_date ?? a.created_at ?? '';
        const db = b.planned_date ?? b.created_at ?? '';
        return db.localeCompare(da);
      })
      .slice(0, 6);
  }, [filteredActivities]);

  const periodLabel = PERIOD_OPTIONS.find((o) => o.value === period)?.label ?? '';

  if (loading) return <Spinner />;


  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Gestão</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Visão geral das atividades e gastos</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFiltersOpen((v) => !v)}
            className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm font-semibold transition ${filtersOpen || activeFilterCount > 0 ? 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'}`}
            title="Filtros"
          >
            <SlidersHorizontal size={16} />
            Filtros{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
          </button>
          <div className="relative inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 shadow-sm transition-colors dark:border-slate-600 dark:bg-slate-800">
            <Calendar size={16} className="shrink-0 text-slate-500 dark:text-slate-300" />
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as PeriodKey)}
              className="appearance-none bg-transparent pr-4 text-sm font-semibold text-slate-900 focus:outline-none dark:text-white"
            >
              {PERIOD_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <ChevronDown size={14} className="pointer-events-none absolute right-3 text-slate-500 dark:text-slate-300" />
          </div>
          <button
            onClick={() => setAlertModal(lateActivities.length > 0 ? 'late' : 'noEvidence')}
            className="relative rounded-xl border border-slate-200 bg-white p-2.5 text-slate-500 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"
            title="Alertas"
          >
            <Bell size={18} />
            {alertCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">{alertCount}</span>
            )}
          </button>
        </div>
      </div>

      {filtersOpen && (
        <Card className="p-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Select label="Colaborador" value={collabFilter} onChange={setCollabFilter} options={collaborators.filter((c) => c.active).map((c) => ({ value: c.id, label: c.name }))} placeholder="Todos" />
            <Select label="Obra" value={projectFilter} onChange={setProjectFilter} options={projects.map((p) => ({ value: p.id, label: p.name }))} placeholder="Todas" />
            <Select
              label="Status"
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: 'planejada', label: 'Pendente' },
                { value: 'em_andamento', label: 'Em andamento' },
                { value: 'concluida', label: 'Concluída' },
                { value: 'cancelada', label: 'Cancelada' },
                { value: 'atrasada', label: 'Atrasada' },
              ]}
              placeholder="Todos"
            />
          </div>
        </Card>
      )}

      <div className="card-grid">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          const diff = kpi.prev > 0 ? Math.round(((kpi.value - kpi.prev) / kpi.prev) * 100) : null;
          const TrendIcon = diff === null ? Minus : diff >= 0 ? ArrowUp : ArrowDown;
          const trendColor = diff === null || diff === 0 ? 'text-slate-400 dark:text-slate-500' : diff > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400';

          return (
            <Card key={kpi.label} className="metric-card">
              <div className="flex items-center gap-4">
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${kpi.chip}`}>
                  <Icon size={22} />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-slate-500 dark:text-slate-400">{kpi.label}</p>
                  <p className="mt-0.5 truncate text-xl font-bold text-slate-900 dark:text-white">{formatCurrency(kpi.value)}</p>
                  <p className={`mt-0.5 flex items-center gap-1 text-xs font-semibold ${trendColor}`}>
                    <TrendIcon size={12} />
                    {diff === null ? 'sem base anterior' : `${Math.abs(diff)}% vs período anterior`}
                  </p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>


      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(240px,0.8fr)_minmax(0,2fr)]">
        <Card className="flex min-w-0 flex-col items-center rounded-3xl border-0 bg-slate-900 p-6 text-center text-white dark:bg-slate-800">
          {isConsolidated ? (
            <img src={'/favicon.svg'} alt="Consolidado" className="h-28 w-28 rounded-3xl bg-white object-contain p-4 ring-4 ring-slate-700/60" />
          ) : avatarUrl ? (
            <img src={avatarUrl} alt={displayProfile?.name ?? 'Avatar'} className="h-28 w-28 rounded-full object-cover ring-4 ring-slate-700/60" />
          ) : (
            <div className="flex h-28 w-28 items-center justify-center rounded-full bg-slate-700 text-3xl font-bold ring-4 ring-slate-700/60">
              {displayProfile ? initials(displayProfile.name) : '?'}
            </div>
          )}
          <h2 className="mt-4 text-2xl font-bold">{isConsolidated ? 'Consolidado' : displayProfile?.name ?? 'Usuário'}</h2>
          {isConsolidated ? (
            <p className="mt-1 text-sm text-slate-300">Visão geral de todos os colaboradores</p>
          ) : (
            <p className="mt-1 text-sm text-slate-300">{displayProfile ? ROLE_LABELS[displayProfile.role] : ''}</p>
          )}
                    {!isConsolidated && (
          <span className="mt-3 inline-flex items-center gap-2 rounded-full bg-slate-800 px-3.5 py-1.5 text-xs font-semibold">
            {displayProfile && profile && displayProfile.id === profile.id ? (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </span>
                Online
              </>
            ) : (
              <>
                <span className={`h-2 w-2 rounded-full ${displayProfile?.active ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                {displayProfile?.active ? 'Ativo' : 'Inativo'}
              </>
            )}
          </span>
          )}

          {!isConsolidated && (
          <div className="mt-6 w-full space-y-3 border-t border-slate-700/60 pt-5 text-left text-sm text-slate-300">
            {displayProfile?.email && (
              <p className="flex items-center gap-2.5"><Mail size={15} className="shrink-0 text-slate-400" /><span className="truncate">{displayProfile.email}</span></p>
            )}
            {displayProfile?.phone && (
              <p className="flex items-center gap-2.5"><Phone size={15} className="shrink-0 text-slate-400" />{displayProfile.phone}</p>
            )}
            {displayProfile?.created_at && (
              <p className="flex items-center gap-2.5"><Calendar size={15} className="shrink-0 text-slate-400" />Desde {new Date(displayProfile.created_at).toLocaleDateString('pt-BR', { month: '2-digit', year: 'numeric' })}</p>
            )}
          </div>
          )}

          {!isConsolidated && (
          <div className="mt-6 w-full space-y-2.5 border-t border-slate-700/60 pt-5 text-left">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400"><HardHat size={14} className="shrink-0" /> Obras Alocadas</p>
            {allocatedProjects.length === 0 ? (
              <p className="text-sm italic text-slate-400">Não está alocado(a) a nenhuma obra</p>
            ) : (
              <div className="space-y-2">
                {allocatedProjects.map((p) => {
                  const isCurrent = p.status === 'em_andamento';
                  return (
                    <div
                      key={p.id}
                      className={`flex flex-col gap-1.5 rounded-lg bg-slate-800/70 px-3 py-2 text-left transition-shadow ${
                        isCurrent ? 'border-2 border-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.45)]' : 'border border-transparent'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate text-sm font-medium text-white">{p.name}</span>
                        <span className="flex shrink-0 items-center gap-1.5 text-[11px] font-semibold text-slate-300">
                          <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: PROJECT_STATUS_DOT[p.status] }} />
                          {PROJECT_STATUS_LABELS[p.status]}
                        </span>
                      </div>
                      {p.start_date && (
                        <span className="flex items-center gap-1 text-[11px] text-slate-400">
                          <Calendar size={11} className="shrink-0" />
                          <span className="whitespace-nowrap">
                            {formatDate(p.start_date)}
                            {p.planned_end_date ? ` → ${formatDate(p.planned_end_date)}` : ''}
                          </span>
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          )}

          <div className="mt-6 grid w-full grid-cols-2 divide-x divide-slate-700/60 rounded-2xl bg-slate-800/70 p-4">
            <div className="px-2">
              <p className="flex items-center gap-1.5 text-xs text-slate-400"><ClipboardList size={13} className="shrink-0" /> Atividades Concluídas</p>
              <p className="mt-1 text-2xl font-bold text-sky-400">{cardCompleted}</p>
            </div>
            <div className="px-2">
              <p className="flex items-center gap-1.5 text-xs text-slate-400"><Wallet size={13} className="shrink-0" /> Total de Gastos no Período</p>
              <p className="mt-1 text-2xl font-bold text-emerald-400">{formatCurrency(cardTotalCost)}</p>
            </div>
          </div>
        </Card>

        <div className="min-w-0 space-y-6">
          {/* Grid responsivo ao container (auto-fit): quando o sidebar recolhe e o espaço
              útil aumenta, os cards dos gráficos se expandem/reflow para preencher a área
              liberada à esquerda; empilham quando não há largura suficiente */}
          <div className="fluid-grid">
            <Card className="content-card">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">Evolução dos Gastos</h2>
                <span className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-500 dark:border-slate-700 dark:text-slate-400">{periodLabel}</span>
              </div>
              <ExpenseTrendChart data={trend} />
              <div className="mt-3 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span className="h-2.5 w-2.5 rounded-full bg-blue-500" /> Gastos no período
              </div>
            </Card>

            <Card className="content-card">
              <h2 className="mb-4 text-base font-semibold text-slate-900 dark:text-white">Status das Atividades</h2>
              <StatusDonutChart counts={statusCounts} />
            </Card>
          </div>

          <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(240px,0.8fr)]">
            <Card className="min-w-0 overflow-hidden">
              <div className="border-b border-slate-100 p-5 dark:border-slate-800">
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">Atividades Recentes</h2>
              </div>
              {recentActivities.length === 0 ? (
                <p className="py-10 text-center text-sm text-slate-400 dark:text-slate-500">Nenhuma atividade no período</p>
              ) : (
                <>
                  <div className="table-scroll">
                    <table className="w-full text-left text-sm">
                      <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-400">
                        <tr>
                          <th className="px-5 py-3 font-semibold">Atividade</th>
                          <th className="hidden px-5 py-3 font-semibold md:table-cell">Obra</th>
                          <th className="hidden px-5 py-3 font-semibold sm:table-cell">Data</th>
                          <th className="px-5 py-3 font-semibold">Gasto Total</th>
                          <th className="px-5 py-3 font-semibold">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {recentActivities.map((a) => (
                          <tr key={a.id} onClick={() => onOpenActivity?.(a.id)} className="cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50">
                            <td className="px-5 py-3.5">
                              <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-500 dark:bg-indigo-950/40 dark:text-indigo-400">
                                  <ClipboardList size={17} />
                                </div>
                                <span className="font-medium text-slate-900 dark:text-white">{a.title}</span>
                              </div>
                            </td>
                            <td className="hidden px-5 py-3.5 text-slate-600 dark:text-slate-300 md:table-cell">{a.project?.name ?? '-'}</td>
                            <td className="hidden px-5 py-3.5 text-slate-600 dark:text-slate-300 sm:table-cell">{formatDateBR(a.planned_date)}</td>
                            <td className="px-5 py-3.5 font-semibold text-slate-900 dark:text-white">{formatCurrency(costByActivity.get(a.id) ?? 0)}</td>
                            <td className="px-5 py-3.5">
                              <Badge className={isLate(a) ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-400' : ACTIVITY_STATUS_COLORS[a.status]}>
                                {isLate(a) ? 'Atrasada' : ACTIVITY_STATUS_LABELS[a.status]}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <button
                    onClick={() => onNavigate?.('activities')}
                    className="flex w-full items-center justify-center gap-1.5 border-t border-slate-100 py-3.5 text-sm font-semibold text-indigo-600 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:text-indigo-400 dark:hover:bg-slate-800/50"
                  >
                    Ver todas as atividades <ChevronRight size={16} />
                  </button>
                </>
              )}
            </Card>

            <Card className="content-card">
              <h2 className="mb-4 text-base font-semibold text-slate-900 dark:text-white">Resumo do Período</h2>
              <div className="space-y-4">
                <div className="flex items-center gap-3.5">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400"><ClipboardList size={20} /></div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Atividades Realizadas</p>
                    <p className="text-xl font-bold text-slate-900 dark:text-white">{completedCount}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">{completionRate}% de conclusão</p>
                  </div>
                </div>
                <div className="flex items-center gap-3.5">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"><Wallet size={20} /></div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Média de Gasto por Dia</p>
                    <p className="text-xl font-bold text-slate-900 dark:text-white">{formatCurrency(activeDays > 0 ? totalCost / activeDays : 0)}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">no período selecionado</p>
                  </div>
                </div>
                <div className="flex items-center gap-3.5">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400"><Zap size={20} /></div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Maior Gasto</p>
                    <p className="text-xl font-bold text-slate-900 dark:text-white">{formatCurrency(topExpenseActivity?.amount ?? 0)}</p>
                    <p className="truncate text-xs text-slate-400 dark:text-slate-500">{topExpenseActivity?.title ?? 'Nenhum registro'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3.5">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400"><MapPin size={20} /></div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Quilometragem Total</p>
                    <p className="text-xl font-bold text-slate-900 dark:text-white">{totalKm.toLocaleString('pt-BR')} km</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">no período selecionado</p>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Mapa de Atividades</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Todas as atividades planejadas, em andamento, concluídas e atrasadas. Clique nos marcadores para ver o detalhamento da atividade e o usuário responsável.
            </p>
          </div>
        </div>
        <ActivityMap
          activities={activities}
          onSelect={(a) => setSelectedActivity(a as ActivityWithRelations)}
        />
      </section>

      <Modal
        open={alertModal !== null}
        onClose={() => setAlertModal(null)}
        title={alertModal === 'late' ? 'Atividades atrasadas' : 'Concluídas sem evidência'}
        size="lg"
      >
        {alertModal === 'late' ? (
          lateActivities.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400 dark:text-slate-500">Nenhuma atividade atrasada.</p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {lateActivities.map((a) => (
                <button key={a.id} onClick={() => { setAlertModal(null); onOpenActivity?.(a.id); }} className="flex w-full items-center justify-between gap-3 py-3 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-900 dark:text-white">{a.title}</p>
                    <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">{a.responsible?.name ? `${a.responsible.name} · ` : ''}{a.project?.name ?? 'Sem obra'} · Prazo: {formatDateBR(a.planned_date)}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-700 dark:bg-rose-900/40 dark:text-rose-400">{daysLate(a)} dia{daysLate(a) > 1 ? 's' : ''}</span>
                </button>
              ))}
            </div>
          )
        ) : activitiesWithoutEvidence.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400 dark:text-slate-500">Nenhuma pendência de evidência.</p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {activitiesWithoutEvidence.map((a) => (
              <button key={a.id} onClick={() => { setAlertModal(null); onOpenActivity?.(a.id); }} className="flex w-full items-center justify-between gap-3 py-3 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-900 dark:text-white">{a.title}</p>
                  <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">{a.project?.name ?? 'Sem obra'} · {formatDateBR(a.planned_date)}</p>
                </div>
                <AlertTriangle size={16} className="shrink-0 text-amber-500" />
              </button>
            ))}
          </div>
        )}
      </Modal>

      <ActivityDetailModal
        activity={selectedActivity}
        onClose={() => setSelectedActivity(null)}
        onOpen={(id) => {
          setSelectedActivity(null);
          onOpenActivity?.(id);
        }}
      />
    </div>
  );
}


function ExpenseTrendChart({ data }: { data: { label: string; value: number }[] }) {
  const W = 560;
  const H = 240;
  const pl = 64;
  const pr = 16;
  const pt = 16;
  const pb = 30;
  const iw = W - pl - pr;
  const ih = H - pt - pb;

  const rawMax = Math.max(...data.map((d) => d.value), 1);
  const pow = Math.pow(10, Math.floor(Math.log10(rawMax)));
  const niceMax = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].map((m) => m * pow).find((c) => c >= rawMax) ?? rawMax;

  const x = (i: number) => (data.length <= 1 ? pl + iw / 2 : pl + (i / (data.length - 1)) * iw);
  const y = (v: number) => pt + ih - (v / niceMax) * ih;

  const points = data.map((d, i) => `${x(i)},${y(d.value)}`).join(' ');
  const areaPath =
    data.length > 1
      ? `M ${x(0)},${y(data[0].value)} ${data.map((d, i) => `L ${x(i)},${y(d.value)}`).join(' ')} L ${x(data.length - 1)},${pt + ih} L ${x(0)},${pt + ih} Z`
      : '';

  const labelStep = Math.max(1, Math.ceil(data.length / 6));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full">
      {[0, 1, 2, 3, 4].map((t) => {
        const v = (niceMax / 4) * t;
        return (
          <g key={t}>
            <line x1={pl} x2={W - pr} y1={y(v)} y2={y(v)} className="stroke-slate-100 dark:stroke-slate-800" strokeWidth={1} />
            <text x={pl - 8} y={y(v)} textAnchor="end" dominantBaseline="middle" className="fill-slate-400 dark:fill-slate-500" fontSize={10}>
              {formatCompactCurrency(v)}
            </text>
          </g>
        );
      })}
      {areaPath && <path d={areaPath} fill="#3b82f6" fillOpacity={0.08} />}
      <polyline points={points} fill="none" stroke="#3b82f6" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {data.map((d, i) => (
        <circle key={i} cx={x(i)} cy={y(d.value)} r={3} fill="#3b82f6" />
      ))}
      {data.map((d, i) =>
        i % labelStep === 0 || i === data.length - 1 ? (
          <text key={`l-${i}`} x={x(i)} y={H - 8} textAnchor="middle" className="fill-slate-400 dark:fill-slate-500" fontSize={10}>
            {d.label}
          </text>
        ) : null,
      )}
    </svg>
  );
}

function ExpenseDonut({ segments, total, valueFormatter = formatCurrency }: { segments: { label: string; value: number; color: string }[]; total: number; valueFormatter?: (value: number) => string }) {
  const r = 70;
  const circumference = 2 * Math.PI * r;
  let offset = 0;
  const visible = segments.filter((s) => s.value > 0);

  return (
    <div className="relative h-40 w-40 shrink-0">
      <svg viewBox="0 0 200 200" className="h-full w-full -rotate-90">
        <circle cx="100" cy="100" r={r} fill="none" strokeWidth={30} className="stroke-slate-100 dark:stroke-slate-800" />
        {visible.map((s) => {
          const dash = (s.value / total) * circumference;
          const circle = (
            <circle
              key={s.label}
              cx="100"
              cy="100"
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={30}
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-offset}
            />
          );
          offset += dash;
          return circle;
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-xs text-slate-400 dark:text-slate-500">Total</span>
        <span className="px-4 text-lg font-bold leading-tight text-slate-900 dark:text-white">{valueFormatter(total)}</span>
      </div>
    </div>
  );
}

function StatusDonutChart({ counts }: { counts: { concluidas: number; atrasadas: number; agendadas: number; pendentes: number } }) {
  const total = counts.concluidas + counts.atrasadas + counts.agendadas + counts.pendentes;
  const segments = STATUS_META.map((m) => ({ label: m.label, value: counts[m.key], color: m.color }));

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row">
      <ExpenseDonut segments={segments} total={total} valueFormatter={(v) => String(v)} />
      <div className="w-full flex-1 space-y-2.5">
        {STATUS_META.map((m) => (
          <div key={m.key} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2.5">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: m.color }} />
              <span className="truncate text-slate-600 dark:text-slate-300">{m.label}</span>
            </span>
            <span className="flex shrink-0 items-center gap-3">
              <span className="font-medium text-slate-500 dark:text-slate-400">{total > 0 ? `${Math.round((counts[m.key] / total) * 100)}%` : '–'}</span>
              <span className="w-6 text-right font-semibold text-slate-900 dark:text-white">{counts[m.key]}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}