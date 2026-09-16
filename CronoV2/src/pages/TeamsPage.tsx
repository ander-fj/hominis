import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Card, Button, Input, Select, Modal, Spinner, EmptyState,
} from '@/components/ui';
import type { Team, Profile, TeamMember } from '@/types';
import { Users, Plus, Pencil, Trash2, X } from 'lucide-react';
import { initials } from '@/lib/utils';

type TeamWithRelations = Team & { leader: Profile | null; team_members: (TeamMember & { user: Profile })[] };

export function TeamsPage() {
  const [loading, setLoading] = useState(true);
  const [teams, setTeams] = useState<TeamWithRelations[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Team | null>(null);
  const [form, setForm] = useState<Partial<Team>>({});

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('teams')
      .select('*, leader:profiles(*), team_members(*, user:profiles(*))')
      .order('name');
    setTeams((data as TeamWithRelations[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    (async () => {
      await load();
      const { data } = await supabase.from('profiles').select('*').eq('active', true).order('name');
      setProfiles((data as Profile[]) ?? []);
    })();
  }, []);

  const openNew = () => { setEditing(null); setForm({ active: true }); setModalOpen(true); };
  const openEdit = (t: Team) => { setEditing(t); setForm(t); setModalOpen(true); };

  const save = async () => {
    if (editing) await supabase.from('teams').update(form).eq('id', editing.id);
    else await supabase.from('teams').insert(form);
    setModalOpen(false);
    await load();
  };

  const remove = async (id: string) => {
    if (!confirm('Excluir esta equipe?')) return;
    await supabase.from('teams').delete().eq('id', id);
    await load();
  };

  const addMember = async (teamId: string, userId: string) => {
    if (!userId) return;
    await supabase.from('team_members').insert({ team_id: teamId, user_id: userId });
    await load();
  };

  const removeMember = async (memberId: string) => {
    await supabase.from('team_members').delete().eq('id', memberId);
    await load();
  };

  if (loading) return <Spinner />;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Equipes</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Gerencie as equipes de campo</p>
        </div>
        <Button onClick={openNew}><Plus size={18} /> Nova equipe</Button>
      </div>

      {teams.length === 0 ? (
        <EmptyState icon={<Users size={48} />} title="Nenhuma equipe encontrada" />
      ) : (
        <div className="content-grid">
          {teams.map((t) => (
            <Card key={t.id} className="content-card">
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-white">{t.name}</h3>
                  <p className="text-xs text-slate-400 dark:text-slate-500">Líder: {t.leader?.name ?? '-'}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={() => openEdit(t)}><Pencil size={14} /></Button>
                  <Button variant="ghost" size="sm" onClick={() => remove(t.id)} className="text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-900/20"><Trash2 size={14} /></Button>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Membros ({t.team_members?.length ?? 0})</p>
                {t.team_members?.map((m) => (
                  <div key={m.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/50">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-200">
                        {initials(m.user.name)}
                      </div>
                      <span className="text-sm text-slate-700 dark:text-slate-200">{m.user.name}</span>
                    </div>
                    <button onClick={() => removeMember(m.id)} className="text-slate-400 hover:text-rose-600 dark:text-slate-500 dark:hover:text-rose-400">
                      <X size={16} />
                    </button>
                  </div>
                ))}
                <div className="flex gap-2 pt-1">
                  <Select
                    value=""
                    onChange={(v) => addMember(t.id, v)}
                    options={profiles
                      .filter((p) => !t.team_members?.some((m) => m.user_id === p.id))
                      .map((p) => ({ value: p.id, label: p.name }))}
                    placeholder="Adicionar membro..."
                    className="flex-1"
                  />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar equipe' : 'Nova equipe'}>
        <div className="space-y-4">
          <Input label="Nome da equipe" value={form.name ?? ''} onChange={(v) => setForm({ ...form, name: v })} required />
          <Select
            label="Líder"
            value={form.leader_id ?? ''}
            onChange={(v) => setForm({ ...form, leader_id: v || null })}
            options={profiles.map((p) => ({ value: p.id, label: p.name }))}
            placeholder="Selecione..."
          />
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
          <Button onClick={save}>{editing ? 'Salvar' : 'Criar'}</Button>
        </div>
      </Modal>
    </div>
  );
}
