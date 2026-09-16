import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Card, Button, Input, Select, Textarea, Modal, Badge, Spinner, EmptyState,
} from '@/components/ui';
import {
  WORK_ORDER_STATUS_LABELS, WORK_ORDER_STATUS_COLORS,
  PRIORITY_LABELS, PRIORITY_COLORS,
  type WorkOrder, type Project, type Profile, type Team,
  type WorkOrderStatus, type Priority,
} from '@/types';
import { formatDate } from '@/lib/utils';
import { ClipboardList, Plus, Pencil, Trash2, Search, Calendar } from 'lucide-react';

type WorkOrderWithRelations = WorkOrder & { project: Project | null; responsible: Profile | null; team: Team | null };

const STATUS_OPTIONS = Object.entries(WORK_ORDER_STATUS_LABELS).map(([v, l]) => ({ value: v, label: l }));
const PRIORITY_OPTIONS = Object.entries(PRIORITY_LABELS).map(([v, l]) => ({ value: v, label: l }));

export function WorkOrdersPage() {
  const [loading, setLoading] = useState(true);
  const [workOrders, setWorkOrders] = useState<WorkOrderWithRelations[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [responsibles, setResponsibles] = useState<Profile[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<WorkOrder | null>(null);
  const [form, setForm] = useState<Partial<WorkOrder>>({});

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('work_orders')
      .select('*, project:projects(*), responsible:profiles(*), team:teams(*)')
      .order('created_at', { ascending: false });
    setWorkOrders((data as WorkOrderWithRelations[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    (async () => {
      await load();
      const [p, r, t] = await Promise.all([
        supabase.from('projects').select('*').order('name'),
        supabase.from('profiles').select('*').eq('active', true).order('name'),
        supabase.from('teams').select('*').eq('active', true).order('name'),
      ]);
      setProjects((p.data as Project[]) ?? []);
      setResponsibles((r.data as Profile[]) ?? []);
      setTeams((t.data as Team[]) ?? []);
    })();
  }, []);

  const openNew = () => {
    setEditing(null);
    setForm({ status: 'aberta', priority: 'media' });
    setModalOpen(true);
  };

  const openEdit = (wo: WorkOrder) => {
    setEditing(wo);
    setForm(wo);
    setModalOpen(true);
  };

  const save = async () => {
    if (editing) {
      await supabase.from('work_orders').update(form).eq('id', editing.id);
    } else {
      await supabase.from('work_orders').insert(form);
    }
    setModalOpen(false);
    await load();
  };

  const remove = async (id: string) => {
    if (!confirm('Excluir esta ordem de serviço?')) return;
    await supabase.from('work_orders').delete().eq('id', id);
    await load();
  };

  const filtered = workOrders.filter((wo) => {
    const matchSearch = !search || wo.title.toLowerCase().includes(search.toLowerCase()) || wo.number.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !statusFilter || wo.status === statusFilter;
    return matchSearch && matchStatus;
  });

  if (loading) return <Spinner />;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Ordens de Serviço</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Gerencie as OS vinculadas às obras</p>
        </div>
        <Button onClick={openNew}><Plus size={18} /> Nova OS</Button>
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

      {filtered.length === 0 ? (
        <EmptyState icon={<ClipboardList size={48} />} title="Nenhuma OS encontrada" description="Crie a primeira ordem de serviço" />
      ) : (
        <div className="space-y-3">
          {filtered.map((wo) => (
            <Card key={wo.id} className="p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-400 dark:text-slate-500">{wo.number}</span>
                    <Badge className={PRIORITY_COLORS[wo.priority]}>{PRIORITY_LABELS[wo.priority]}</Badge>
                    <Badge className={WORK_ORDER_STATUS_COLORS[wo.status]}>{WORK_ORDER_STATUS_LABELS[wo.status]}</Badge>
                  </div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{wo.title}</h3>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                    <span>Obra: {wo.project?.name ?? '-'}</span>
                    <span>Resp.: {wo.responsible?.name ?? '-'}</span>
                    <span className="flex items-center gap-1"><Calendar size={12} /> {formatDate(wo.planned_date)}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={() => openEdit(wo)}><Pencil size={14} /> Editar</Button>
                  <Button variant="ghost" size="sm" onClick={() => remove(wo.id)} className="text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-900/20"><Trash2 size={14} /></Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar OS' : 'Nova ordem de serviço'} size="lg">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Número" value={form.number ?? ''} onChange={(v) => setForm({ ...form, number: v })} required />
          <Select
            label="Obra"
            value={form.project_id ?? ''}
            onChange={(v) => setForm({ ...form, project_id: v })}
            options={projects.map((p) => ({ value: p.id, label: `${p.code} - ${p.name}` }))}
            placeholder="Selecione..."
            required
          />
          <Input label="Título" value={form.title ?? ''} onChange={(v) => setForm({ ...form, title: v })} required className="sm:col-span-2" />
          <Textarea label="Descrição" value={form.description ?? ''} onChange={(v) => setForm({ ...form, description: v })} className="sm:col-span-2" />
          <Select label="Prioridade" value={form.priority ?? 'media'} onChange={(v) => setForm({ ...form, priority: v as Priority })} options={PRIORITY_OPTIONS} />
          <Select label="Status" value={form.status ?? 'aberta'} onChange={(v) => setForm({ ...form, status: v as WorkOrderStatus })} options={STATUS_OPTIONS} />
          <Select
            label="Responsável"
            value={form.responsible_id ?? ''}
            onChange={(v) => setForm({ ...form, responsible_id: v || null })}
            options={responsibles.map((r) => ({ value: r.id, label: r.name }))}
            placeholder="Selecione..."
          />
          <Select
            label="Equipe"
            value={form.team_id ?? ''}
            onChange={(v) => setForm({ ...form, team_id: v || null })}
            options={teams.map((t) => ({ value: t.id, label: t.name }))}
            placeholder="Selecione..."
          />
          <Input label="Data planejada" type="date" value={form.planned_date ?? ''} onChange={(v) => setForm({ ...form, planned_date: v || null })} />
          <Input label="Horário planejado" type="time" value={form.planned_time ?? ''} onChange={(v) => setForm({ ...form, planned_time: v || null })} />
          <Input label="Local" value={form.location ?? ''} onChange={(v) => setForm({ ...form, location: v })} className="sm:col-span-2" />
          <Textarea label="Observações" value={form.notes ?? ''} onChange={(v) => setForm({ ...form, notes: v })} className="sm:col-span-2" />
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
          <Button onClick={save}>{editing ? 'Salvar' : 'Criar OS'}</Button>
        </div>
      </Modal>
    </div>
  );
}
