import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Card, Badge, Button, Input, Select, Modal, Spinner, EmptyState,
} from '@/components/ui';
import { ROLE_LABELS, type Profile, type UserRole } from '@/types';
import { initials } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { UserPlus, Users, Upload, X, Pencil } from 'lucide-react';

const ROLE_COLORS: Record<UserRole, string> = {
  admin: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900',
  gestor: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900',
  tecnico: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900',
  financeiro: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900',
};

const ROLE_OPTIONS: { value: string; label: string }[] = (Object.keys(ROLE_LABELS) as UserRole[]).map((r) => ({
  value: r,
  label: ROLE_LABELS[r],
}));

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

type AvatarFile = { type: string; data: string } | null;

export function UsersPage() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [editForm, setEditForm] = useState({ name: '', role: 'tecnico', phone: '', active: true });
  const [editAvatarFile, setEditAvatarFile] = useState<AvatarFile>(null);
  const [editAvatarPreview, setEditAvatarPreview] = useState<string | null>(null);
  const [editAvatarRemoved, setEditAvatarRemoved] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'tecnico', phone: '' });
  const [avatarFile, setAvatarFile] = useState<AvatarFile>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [avatarUrls, setAvatarUrls] = useState<Record<string, string>>({});

  const isAdmin = profile?.role === 'admin';

  const loadProfiles = async () => {
    setLoading(true);
    const { data } = await supabase.from('profiles').select('*').order('name');
    const list = (data as Profile[]) ?? [];
    setProfiles(list);
    setLoading(false);
  };

  useEffect(() => {
    void loadProfiles();
  }, []);

  useEffect(() => {
    const paths = profiles.filter((p) => p.avatar_url).map((p) => p.avatar_url!);
    if (paths.length === 0) {
      setAvatarUrls({});
      return;
    }
    const loadAvatars = async () => {
      const entries = await Promise.all(
        paths.map(async (path) => {
          const { data } = await supabase.storage.from('avatars').createSignedUrl(path, 3600);
          return [path, data?.signedUrl ?? ''] as const;
        }),
      );
      setAvatarUrls(Object.fromEntries(entries.filter(([, url]) => url)));
    };
    void loadAvatars();
  }, [profiles]);

  const resetForm = () => {
    setForm({ name: '', email: '', password: '', role: 'tecnico', phone: '' });
    setAvatarFile(null);
    setAvatarPreview(null);
    setAvatarError('');
    setFormError('');
  };

  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setAvatarError('');
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setAvatarError('Formato inválido. Use JPG, PNG ou WebP.');
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setAvatarError('A imagem deve ter no máximo 2 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setAvatarPreview(result);
      setAvatarFile({ type: file.type, data: result.split(',')[1] ?? '' });
    };
    reader.readAsDataURL(file);
  };

  const removeAvatar = () => {
    setAvatarFile(null);
    setAvatarPreview(null);
  };

  const handleAddUser = async () => {
    setSaving(true);
    setFormError('');

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        setFormError('Sessão expirada. Faça login novamente.');
        setSaving(false);
        return;
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
          role: form.role,
          phone: form.phone.trim() || null,
          avatar: avatarFile,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setFormError(result?.error || 'Não foi possível criar o usuário');
        setSaving(false);
        return;
      }

      setShowAddModal(false);
      resetForm();
      await loadProfiles();
    } catch {
      setFormError('Erro de conexão. Tente novamente.');
    }

    setSaving(false);
  };

  const resetEditForm = () => {
    setEditForm({ name: '', role: 'tecnico', phone: '', active: true });
    setEditAvatarFile(null);
    setEditAvatarPreview(null);
    setEditAvatarRemoved(false);
    setEditError('');
  };

  const openEdit = (p: Profile) => {
    setEditingUser(p);
    setEditForm({ name: p.name, role: p.role, phone: p.phone ?? '', active: p.active });
    setEditAvatarPreview(avatarUrls[p.avatar_url ?? ''] ?? null);
    setEditAvatarFile(null);
    setEditAvatarRemoved(false);
    setEditError('');
  };

  const handleEditAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setEditError('');
    setEditAvatarRemoved(false);
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setEditError('Formato inválido. Use JPG, PNG ou WebP.');
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setEditError('A imagem deve ter no máximo 2 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setEditAvatarPreview(result);
      setEditAvatarFile({ type: file.type, data: result.split(',')[1] ?? '' });
    };
    reader.readAsDataURL(file);
  };

  const removeEditAvatar = () => {
    setEditAvatarFile(null);
    setEditAvatarPreview(null);
    setEditAvatarRemoved(true);
  };

  const handleEditUser = async () => {
    if (!editingUser) return;
    setEditSaving(true);
    setEditError('');

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        setEditError('Sessão expirada. Faça login novamente.');
        setEditSaving(false);
        return;
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/update-user`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          id: editingUser.id,
          name: editForm.name.trim(),
          role: editForm.role,
          phone: editForm.phone.trim() || null,
          active: editForm.active,
          avatar: editAvatarFile,
          removeAvatar: editAvatarRemoved,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setEditError(result?.error || 'Não foi possível atualizar o usuário');
        setEditSaving(false);
        return;
      }

      setEditingUser(null);
      resetEditForm();
      await loadProfiles();
    } catch {
      setEditError('Erro de conexão. Tente novamente.');
    }

    setEditSaving(false);
  };

  if (loading) return <Spinner />;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Usuários</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Usuários do sistema e seus perfis de acesso</p>
        </div>
        {isAdmin && (
          <Button onClick={() => { resetForm(); setShowAddModal(true); }} className="self-start sm:self-auto">
            <UserPlus size={18} /> Adicionar usuário
          </Button>
        )}
      </div>

      {profiles.length === 0 ? (
        <EmptyState icon={<Users size={48} />} title="Nenhum usuário encontrado" />
      ) : (
        <div className="content-grid">
          {profiles.map((p) => (
            <Card key={p.id} className={`content-card ${isAdmin ? 'cursor-pointer transition-shadow hover:shadow-md' : ''}`} onClick={isAdmin ? () => openEdit(p) : undefined}>
              <div className="flex items-center gap-3">
                {avatarUrls[p.avatar_url ?? ''] ? (
                  <img src={avatarUrls[p.avatar_url ?? '']} alt={p.name} className="h-12 w-12 rounded-full object-cover" />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-200 text-base font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-200">
                    {initials(p.name)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-base font-semibold text-slate-900 dark:text-white">{p.name}</h3>
                  <p className="truncate text-xs text-slate-400 dark:text-slate-500">{p.email}</p>
                </div>
                {isAdmin && <Pencil size={16} className="shrink-0 text-slate-400 dark:text-slate-500" />}
              </div>
              <div className="mt-3 flex items-center gap-2">
                <Badge className={ROLE_COLORS[p.role]}>{ROLE_LABELS[p.role]}</Badge>
                <Badge className={p.active ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900' : 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'}>
                  {p.active ? 'Ativo' : 'Inativo'}
                </Badge>
              </div>
              {p.phone && <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{p.phone}</p>}
            </Card>
          ))}
        </div>
      )}

      <Card className="content-card">
        <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Permissões por perfil</h3>
        <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
          <div className="flex gap-2"><Badge className={ROLE_COLORS.admin}>Admin</Badge> <span>Acesso total: cria usuários, obras, clientes, veículos, aprova despesas e atividades, gera relatórios.</span></div>
          <div className="flex gap-2"><Badge className={ROLE_COLORS.gestor}>Gestor</Badge> <span>Cria OS, distribui atividades, aprova despesas e atividades, acompanha custos.</span></div>
          <div className="flex gap-2"><Badge className={ROLE_COLORS.tecnico}>Técnico</Badge> <span>Registra despesas, materiais, evidências, deslocamentos e finaliza atividades.</span></div>
          <div className="flex gap-2"><Badge className={ROLE_COLORS.financeiro}>Financeiro</Badge> <span>Valida comprovantes, aprova/reprova despesas, exporta relatórios financeiros.</span></div>
        </div>
      </Card>

      <Modal open={showAddModal} onClose={() => setShowAddModal(false)} title="Adicionar usuário">
        <div className="space-y-4">
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              {avatarPreview ? (
                <img src={avatarPreview} alt="Pré-visualização" className="h-20 w-20 rounded-full object-cover border-2 border-slate-200 dark:border-slate-700" />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
                  <Users size={28} />
                </div>
              )}
              {avatarPreview && (
                <button
                  type="button"
                  onClick={removeAvatar}
                  className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-rose-500 text-white shadow-sm transition hover:bg-rose-600"
                  aria-label="Remover imagem"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">
              <Upload size={16} />
              {avatarPreview ? 'Trocar imagem' : 'Adicionar foto'}
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleAvatarChange} className="hidden" />
            </label>
            {avatarError && <p className="text-xs text-rose-600 dark:text-rose-400">{avatarError}</p>}
          </div>

          <Input
            label="Nome"
            value={form.name}
            onChange={(v) => setForm((f) => ({ ...f, name: v }))}
            placeholder="Nome completo"
            required
          />
          <Input
            label="E-mail"
            type="email"
            value={form.email}
            onChange={(v) => setForm((f) => ({ ...f, email: v }))}
            placeholder="email@empresa.com"
            required
          />
          <Input
            label="Senha"
            type="password"
            value={form.password}
            onChange={(v) => setForm((f) => ({ ...f, password: v }))}
            placeholder="Mínimo 6 caracteres"
            required
            showPasswordToggle
          />
          <Select
            label="Perfil de acesso"
            value={form.role}
            onChange={(v) => setForm((f) => ({ ...f, role: v }))}
            options={ROLE_OPTIONS}
            required
          />
          <Input
            label="Telefone (opcional)"
            value={form.phone}
            onChange={(v) => setForm((f) => ({ ...f, phone: v }))}
            placeholder="(00) 00000-0000"
          />
          {formError && (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">{formError}</p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setShowAddModal(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleAddUser} disabled={saving || !form.name || !form.email || !form.password}>
              {saving ? 'Criando...' : 'Criar usuário'}
            </Button>
          </div>
        </div>
      </Modal>

      {isAdmin && editingUser && (
        <Modal open={!!editingUser} onClose={() => { setEditingUser(null); resetEditForm(); }} title="Editar usuário" size="lg">
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-3">
              <div className="relative">
                {editAvatarPreview ? (
                  <img src={editAvatarPreview} alt="Pré-visualização" className="h-20 w-20 rounded-full object-cover border-2 border-slate-200 dark:border-slate-700" />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
                    <Users size={28} />
                  </div>
                )}
                {editAvatarPreview && (
                  <button
                    type="button"
                    onClick={removeEditAvatar}
                    className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-rose-500 text-white shadow-sm transition hover:bg-rose-600"
                    aria-label="Remover imagem"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">
                <Upload size={16} />
                {editAvatarPreview ? 'Trocar imagem' : 'Adicionar foto'}
                <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleEditAvatarChange} className="hidden" />
              </label>
            </div>

            <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
              {editingUser.email}
            </div>

            <Input
              label="Nome"
              value={editForm.name}
              onChange={(v) => setEditForm((f) => ({ ...f, name: v }))}
              placeholder="Nome completo"
              required
            />
            <Select
              label="Perfil de acesso"
              value={editForm.role}
              onChange={(v) => setEditForm((f) => ({ ...f, role: v }))}
              options={ROLE_OPTIONS}
              required
            />
            <Input
              label="Telefone (opcional)"
              value={editForm.phone}
              onChange={(v) => setEditForm((f) => ({ ...f, phone: v }))}
              placeholder="(00) 00000-0000"
            />
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={editForm.active}
                onChange={(e) => setEditForm((f) => ({ ...f, active: e.target.checked }))}
                className="h-4 w-4 rounded border-slate-300 text-amber-500 focus:ring-amber-400 dark:border-slate-600 dark:bg-slate-800"
              />
              <span className="text-sm text-slate-700 dark:text-slate-300">Usuário ativo</span>
            </label>
            {editError && (
              <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">{editError}</p>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => { setEditingUser(null); resetEditForm(); }} disabled={editSaving}>Cancelar</Button>
              <Button onClick={handleEditUser} disabled={editSaving || !editForm.name}>
                {editSaving ? 'Salvando...' : 'Salvar alterações'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
