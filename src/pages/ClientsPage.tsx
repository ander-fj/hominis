import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Card, Button, Input, Modal, Badge, Spinner, EmptyState,
} from '@/components/ui';
import type { Client } from '@/types';
import { Building2, Plus, Pencil, Trash2, Search } from 'lucide-react';

export function ClientsPage() {
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [form, setForm] = useState<Partial<Client>>({});

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('clients').select('*').order('name');
    setClients((data as Client[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm({ active: true }); setModalOpen(true); };
  const openEdit = (c: Client) => { setEditing(c); setForm(c); setModalOpen(true); };

  const save = async () => {
    if (editing) await supabase.from('clients').update(form).eq('id', editing.id);
    else await supabase.from('clients').insert(form);
    setModalOpen(false);
    await load();
  };

  const remove = async (id: string) => {
    if (!confirm('Excluir este cliente?')) return;
    await supabase.from('clients').delete().eq('id', id);
    await load();
  };

  const filtered = clients.filter((c) => !search || c.name.toLowerCase().includes(search.toLowerCase()));

  if (loading) return <Spinner />;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Clientes</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Gerencie os clientes</p>
        </div>
        <Button onClick={openNew}><Plus size={18} /> Novo cliente</Button>
      </div>

      <div className="relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar cliente..."
          className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:border-slate-600 dark:focus:ring-slate-700/40"
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<Building2 size={48} />} title="Nenhum cliente encontrado" />
      ) : (
        <div className="content-grid">
          {filtered.map((c) => (
            <Card key={c.id} className="content-card">
              <div className="mb-2 flex items-start justify-between">
                <div className="min-w-0">
                  <h3 className="truncate text-base font-semibold text-slate-900 dark:text-white">{c.name}</h3>
                  <p className="text-xs text-slate-400 dark:text-slate-500">{c.document ?? '-'}</p>
                </div>
                <Badge className={c.active ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900' : 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'}>
                  {c.active ? 'Ativo' : 'Inativo'}
                </Badge>
              </div>
              <div className="space-y-1 text-sm text-slate-500 dark:text-slate-400">
                {c.email && <p>{c.email}</p>}
                {c.phone && <p>{c.phone}</p>}
                {c.city && <p>{c.city}, {c.state}</p>}
              </div>
              <div className="mt-auto flex gap-2 pt-4">
                <Button variant="secondary" size="sm" onClick={() => openEdit(c)}><Pencil size={14} /> Editar</Button>
                <Button variant="ghost" size="sm" onClick={() => remove(c.id)} className="text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-900/20"><Trash2 size={14} /></Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar cliente' : 'Novo cliente'}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Nome" value={form.name ?? ''} onChange={(v) => setForm({ ...form, name: v })} required className="sm:col-span-2" />
          <Input label="CNPJ/CPF" value={form.document ?? ''} onChange={(v) => setForm({ ...form, document: v })} />
          <Input label="E-mail" type="email" value={form.email ?? ''} onChange={(v) => setForm({ ...form, email: v })} />
          <Input label="Telefone" value={form.phone ?? ''} onChange={(v) => setForm({ ...form, phone: v })} />
          <Input label="CEP" value={form.zip_code ?? ''} onChange={(v) => setForm({ ...form, zip_code: v })} />
          <Input label="Endereço" value={form.address ?? ''} onChange={(v) => setForm({ ...form, address: v })} className="sm:col-span-2" />
          <Input label="Cidade" value={form.city ?? ''} onChange={(v) => setForm({ ...form, city: v })} />
          <Input label="Estado" value={form.state ?? ''} onChange={(v) => setForm({ ...form, state: v })} />
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
          <Button onClick={save}>{editing ? 'Salvar' : 'Criar'}</Button>
        </div>
      </Modal>
    </div>
  );
}
