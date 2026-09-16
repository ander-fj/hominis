import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { createActivity, deleteActivity, getActivities, updateActivity, type ActivityWithRelations } from '@/modules/activities/services/activities.service';
import { changeActivityStatus } from '@/modules/activities/services/activityWorkflow';
import { useDebounce } from '@/shared/hooks/useDebounce';
import {
  Card, Button, Input, Select, Textarea, Modal, Badge, Spinner, EmptyState,
} from '@/components/ui';
import {
  ACTIVITY_STATUS_LABELS, ACTIVITY_STATUS_COLORS,
  type Activity, type Project, type Profile, type WorkOrder,
  type ActivityStatus, type Priority, PRIORITY_LABELS, PRIORITY_COLORS,
} from '@/types';
import { formatDuration } from '@/lib/utils';
import { Activity as ActivityIcon, Plus, Pencil, Trash2, Search, Play, Square, Clock, ChevronRight } from 'lucide-react';

const PRIORITY_OPTIONS = Object.entries(PRIORITY_LABELS).map(([value, label]) => ({ value, label }));
const STATUS_OPTIONS = Object.entries(ACTIVITY_STATUS_LABELS).map(([v, l]) => ({ value: v, label: l }));

export function ActivitiesPage({ onOpenActivity }: { onOpenActivity?: (id: string) => void }) {
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState<ActivityWithRelations[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [responsibles, setResponsibles] = useState<Profile[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 400);
  const [statusFilter, setStatusFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Activity | null>(null);
  const [form, setForm] = useState<Partial<Activity>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getActivities({ page, pageSize: 50, search: debouncedSearch, status: statusFilter as ActivityStatus | '' });
      setActivities(result.data);
      setTotal(result.count);
    } catch (err) {
      console.error(err);
      setError('Não foi possível carregar as atividades. Tente novamente.');
      setActivities([]);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, statusFilter]);

  useEffect(() => {
    (async () => {
      const [p, r, wo] = await Promise.all([
        supabase.from('projects').select('*').order('name'),
        supabase.from('profiles').select('*').eq('active', true).order('name'),
        supabase.from('work_orders').select('*').order('created_at', { ascending: false }),
      ]);
      setProjects((p.data as Project[]) ?? []);
      setResponsibles((r.data as Profile[]) ?? []);
      setWorkOrders((wo.data as WorkOrder[]) ?? []);
    })();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const openNew = async () => {
    setEditing(null);
    const { count } = await supabase
      .from('activities')
      .select('*', { count: 'exact', head: true });
    const next = (count ?? 0) + 1;
    setForm({ status: 'planejada', priority: 'media', number: `ATV-${String(next).padStart(4, '0')}` });
    setModalOpen(true);
  };

  const openEdit = (a: Activity) => {
    setEditing(a);
    setForm(a);
    setModalOpen(true);
  };

  const save = async () => {
    setSaving(true); setError(null);
    try {
      if (editing) await updateActivity(editing.id, form);
      else await createActivity(form);
      setModalOpen(false);
      await load();
    } catch (err) { console.error(err); setError('Não foi possível salvar a atividade.'); }
    finally { setSaving(false); }
  };

  const remove = async (id: string) => {
    if (!confirm('Excluir esta atividade?')) return;
    await deleteActivity(id);
    await load();
  };

  const advanceStatus = async (a: Activity, next: ActivityStatus) => {
    setSaving(true); setError(null);
    try { await changeActivityStatus(a.id, a.status, next); await load(); }
    catch (err) { console.error(err); setError(err instanceof Error ? err.message : 'Não foi possível alterar o status.'); }
    finally { setSaving(false); }
  };

  const filtered = activities;
  const totalPages = Math.max(1, Math.ceil(total / 50));

  if (loading) return <Spinner />;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Atividades</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Controle de atividades de campo</p>
        </div>
        <Button onClick={openNew}><Plus size={18} /> Nova atividade</Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative min-w-0 flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por título ou número..."
            className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:border-slate-600 dark:focus:ring-slate-700/40"
          />
        </div>
        <Select value={statusFilter} onChange={setStatusFilter} options={STATUS_OPTIONS} placeholder="Todos os status" className="sm:w-56" />
      </div>

      {error && <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">{error}</div>}

      {filtered.length === 0 ? (
        <EmptyState icon={<ActivityIcon size={48} />} title="Nenhuma atividade encontrada" description="Crie a primeira atividade" />
      ) : (
        <div className="space-y-3">
          {filtered.map((a) => (
            <Card key={a.id} className={`p-4 ${onOpenActivity ? 'cursor-pointer hover:border-slate-300 hover:shadow-md transition-all' : ''}`} onClick={onOpenActivity ? () => onOpenActivity(a.id) : undefined}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-slate-400 dark:text-slate-500">{a.number}</span>
                    <Badge className={ACTIVITY_STATUS_COLORS[a.status]}>{ACTIVITY_STATUS_LABELS[a.status]}</Badge>
                    <Badge className={PRIORITY_COLORS[a.priority ?? 'media']}>{PRIORITY_LABELS[a.priority ?? 'media']}</Badge>
                  </div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{a.title}</h3>
                  <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                    <span>Obra: {a.project?.name ?? '-'}</span>
                    <span>OS: {a.work_order?.number ?? '-'}</span>
                    <span>Resp.: {a.responsible?.name ?? '-'}</span>
                    {a.started_at && (
                      <span className="flex items-center gap-1"><Clock size={12} /> {formatDuration(a.started_at, a.finished_at)}</span>
                    )}
                  </div>
                </div>
                <div className="flex flex-shrink-0 items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  {a.status === 'planejada' && <Button size="sm" variant="success" disabled={saving} onClick={() => advanceStatus(a, 'em_deslocamento')}><Play size={14} /> Deslocar</Button>}
                  {a.status === 'em_deslocamento' && <Button size="sm" variant="primary" disabled={saving} onClick={() => advanceStatus(a, 'em_andamento')}><Play size={14} /> Iniciar</Button>}
                  {a.status === 'em_andamento' && <Button size="sm" variant="primary" disabled={saving} onClick={() => advanceStatus(a, 'aguardando_validacao')}><Square size={14} /> Enviar</Button>}
                  {a.status === 'aguardando_validacao' && <Button size="sm" variant="success" disabled={saving} onClick={() => advanceStatus(a, 'concluida')}>Validar</Button>}
                  <Button variant="secondary" size="sm" onClick={() => onOpenActivity?.(a.id)}>
                    Abrir <ChevronRight size={14} />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => openEdit(a)}><Pencil size={14} /></Button>
                  <Button variant="ghost" size="sm" onClick={() => remove(a.id)} className="text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-900/20"><Trash2 size={14} /></Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {total > 50 && (
        <div className="mt-5 flex items-center justify-between text-sm">
          <span className="text-slate-500">{total} atividades • Página {page} de {totalPages}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
            <Button size="sm" variant="secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Próxima</Button>
          </div>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar atividade' : 'Nova atividade'} size="lg">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Número" value={form.number ?? ''} onChange={(v) => setForm({ ...form, number: v })} required disabled={!editing} />
          <Select
            label="Ordem de serviço"
            value={form.work_order_id ?? ''}
            onChange={(v) => {
              const wo = workOrders.find((w) => w.id === v);
              setForm({ ...form, work_order_id: v, project_id: wo?.project_id ?? form.project_id });
            }}
            options={workOrders.map((w) => ({ value: w.id, label: `${w.number} - ${w.title}` }))}
            placeholder="Selecione..."
            required
          />
          <Input label="Título" value={form.title ?? ''} onChange={(v) => setForm({ ...form, title: v })} required className="sm:col-span-2" />
          <Textarea label="Descrição" value={form.description ?? ''} onChange={(v) => setForm({ ...form, description: v })} className="sm:col-span-2" />
          <Select
            label="Obra"
            value={form.project_id ?? ''}
            onChange={(v) => setForm({ ...form, project_id: v })}
            options={projects.map((p) => ({ value: p.id, label: `${p.code} - ${p.name}` }))}
            placeholder="Selecione..."
            required
          />
          <Select
            label="Responsável"
            value={form.responsible_id ?? ''}
            onChange={(v) => setForm({ ...form, responsible_id: v || null })}
            options={responsibles.map((r) => ({ value: r.id, label: r.name }))}
            placeholder="Selecione..."
          />
          <Input label="Data planejada" type="date" value={form.planned_date ?? ''} onChange={(v) => setForm({ ...form, planned_date: v || null })} />
          <Input label="Horário planejado" type="time" value={form.planned_time ?? ''} onChange={(v) => setForm({ ...form, planned_time: v || null })} />
          <Input label="Local" value={form.location ?? ''} onChange={(v) => setForm({ ...form, location: v })} className="sm:col-span-2" />
          <Select label="Prioridade" value={form.priority ?? 'media'} onChange={(v) => setForm({ ...form, priority: v as Priority })} options={PRIORITY_OPTIONS} />
          <Select label="Status" value={form.status ?? 'planejada'} onChange={(v) => setForm({ ...form, status: v as ActivityStatus })} options={STATUS_OPTIONS} />
          <Textarea label="Observações" value={form.observations ?? ''} onChange={(v) => setForm({ ...form, observations: v })} className="sm:col-span-2" />
          <Textarea label="Problemas" value={form.problems ?? ''} onChange={(v) => setForm({ ...form, problems: v })} className="sm:col-span-2" />
          <Textarea label="Descrição do serviço" value={form.service_description ?? ''} onChange={(v) => setForm({ ...form, service_description: v })} className="sm:col-span-2" />
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving ? 'Salvando...' : editing ? 'Salvar' : 'Criar atividade'}</Button>
        </div>
      </Modal>
    </div>
  );
}
