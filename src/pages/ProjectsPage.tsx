import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Card, Button, Input, Select, Textarea, Modal, Badge, Spinner, EmptyState,
} from '@/components/ui';
import {
  PROJECT_STATUS_LABELS, PROJECT_STATUS_COLORS,
  type Project, type Client, type Profile,
} from '@/types';
import { formatDate, formatCurrency } from '@/lib/utils';
import { HardHat, Plus, MapPin, Pencil, Trash2, Search } from 'lucide-react';

type ProjectWithRelations = Project & { client: Client | null; manager: Profile | null };

const STATUS_OPTIONS = Object.entries(PROJECT_STATUS_LABELS).map(([v, l]) => ({ value: v, label: l }));

export function ProjectsPage() {
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<ProjectWithRelations[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [managers, setManagers] = useState<Profile[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [form, setForm] = useState<Partial<Project>>({});

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('projects')
      .select('*, client:clients(*), manager:profiles(*)')
      .order('created_at', { ascending: false });
    setProjects((data as ProjectWithRelations[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    (async () => {
      await load();
      const [c, m] = await Promise.all([
        supabase.from('clients').select('*').eq('active', true).order('name'),
        supabase.from('profiles').select('*').eq('active', true).order('name'),
      ]);
      setClients((c.data as Client[]) ?? []);
      setManagers((m.data as Profile[]) ?? []);
    })();
  }, []);

  const openNew = () => {
    setEditing(null);
    setForm({ status: 'planejada', budget: 0 });
    setModalOpen(true);
  };

  const openEdit = (p: Project) => {
    setEditing(p);
    setForm(p);
    setModalOpen(true);
  };

  const save = async () => {
    if (editing) {
      await supabase.from('projects').update(form).eq('id', editing.id);
    } else {
      await supabase.from('projects').insert(form);
    }
    setModalOpen(false);
    await load();
  };

  const remove = async (id: string) => {
    if (!confirm('Excluir esta obra?')) return;
    await supabase.from('projects').delete().eq('id', id);
    await load();
  };

  const filtered = projects.filter((p) => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.code.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !statusFilter || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  if (loading) return <Spinner />;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Obras</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Gerencie as obras e projetos de campo</p>
        </div>
        <Button onClick={openNew}><Plus size={18} /> Nova obra</Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative min-w-0 flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou código..."
            className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:border-slate-600 dark:focus:ring-slate-700/40"
          />
        </div>
        <Select value={statusFilter} onChange={setStatusFilter} options={STATUS_OPTIONS} placeholder="Todos os status" className="sm:w-56" />
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<HardHat size={48} />} title="Nenhuma obra encontrada" description="Crie a primeira obra para começar" />
      ) : (
        <div className="content-grid">
          {filtered.map((p) => (
            <Card key={p.id} className="content-card">
              <div className="mb-3 flex items-start justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-400 dark:text-slate-500">{p.code}</p>
                  <h3 className="truncate text-base font-semibold text-slate-900 dark:text-white">{p.name}</h3>
                </div>
                <Badge className={PROJECT_STATUS_COLORS[p.status]}>{PROJECT_STATUS_LABELS[p.status]}</Badge>
              </div>
              <div className="space-y-1.5 text-sm text-slate-500 dark:text-slate-400">
                <p className="flex items-center gap-1.5"><MapPin size={14} /> {p.city ?? '-'}, {p.state ?? '-'}</p>
                <p>Cliente: {p.client?.name ?? '-'}</p>
                <p>Responsável: {p.manager?.name ?? '-'}</p>
                <p>Início: {formatDate(p.start_date)}</p>
                <p className="font-medium text-slate-700 dark:text-slate-300">Orçamento: {formatCurrency(p.budget)}</p>
              </div>
              <div className="mt-auto flex gap-2 pt-4">
                <Button variant="secondary" size="sm" onClick={() => openEdit(p)}><Pencil size={14} /> Editar</Button>
                <Button variant="ghost" size="sm" onClick={() => remove(p.id)} className="text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-900/20"><Trash2 size={14} /></Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar obra' : 'Nova obra'} size="lg">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Código" value={form.code ?? ''} onChange={(v) => setForm({ ...form, code: v })} required />
          <Input label="Nome da obra" value={form.name ?? ''} onChange={(v) => setForm({ ...form, name: v })} required />
          <Select
            label="Cliente"
            value={form.client_id ?? ''}
            onChange={(v) => setForm({ ...form, client_id: v || null })}
            options={clients.map((c) => ({ value: c.id, label: c.name }))}
            placeholder="Selecione..."
          />
          <Select
            label="Responsável"
            value={form.manager_id ?? ''}
            onChange={(v) => setForm({ ...form, manager_id: v || null })}
            options={managers.map((m) => ({ value: m.id, label: m.name }))}
            placeholder="Selecione..."
          />
          <Input label="Contrato" value={form.contract ?? ''} onChange={(v) => setForm({ ...form, contract: v })} />
          <Input label="Endereço" value={form.address ?? ''} onChange={(v) => setForm({ ...form, address: v })} />
          <Input label="Cidade" value={form.city ?? ''} onChange={(v) => setForm({ ...form, city: v })} />
          <Input label="Estado" value={form.state ?? ''} onChange={(v) => setForm({ ...form, state: v })} />
          <Input label="Data de início" type="date" value={form.start_date ?? ''} onChange={(v) => setForm({ ...form, start_date: v || null })} />
          <Input label="Previsão de término" type="date" value={form.planned_end_date ?? ''} onChange={(v) => setForm({ ...form, planned_end_date: v || null })} />
          <Input label="Orçamento (R$)" type="number" value={form.budget?.toString() ?? ''} onChange={(v) => setForm({ ...form, budget: parseFloat(v) || 0 })} />
          <Textarea label="Descrição" value={form.description ?? ''} onChange={(v) => setForm({ ...form, description: v })} className="sm:col-span-2" />
          <Textarea label="Observações" value={form.notes ?? ''} onChange={(v) => setForm({ ...form, notes: v })} className="sm:col-span-2" />
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
          <Button onClick={save}>{editing ? 'Salvar' : 'Criar obra'}</Button>
        </div>
      </Modal>
    </div>
  );
}
