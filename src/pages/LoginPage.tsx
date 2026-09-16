import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button, Input, Select } from '@/components/ui';
import { ROLE_LABELS, type UserRole } from '@/types';
import { HardHat } from 'lucide-react';

export function LoginPage() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('tecnico');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    if (mode === 'signin') {
      const { error } = await signIn(email, password);
      if (error) setError(error);
    } else {
      const { error } = await signUp(email, password, name, role as UserRole);
      if (error) setError(error);
      else setError('Conta criada! Verifique se não há erros e faça login.');
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 dark:from-black dark:via-slate-900 dark:to-black">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500 text-white shadow-lg shadow-amber-500/30">
            <HardHat size={32} />
          </div>
          <h1 className="text-2xl font-bold text-white">FieldControl</h1>
          <p className="mt-1 text-sm text-slate-400">Controle de atividades de campo</p>
        </div>

        <div className="rounded-2xl bg-white p-8 shadow-xl dark:bg-slate-900 dark:shadow-slate-900/50">
          <div className="mb-6 flex gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
            <button
              onClick={() => setMode('signin')}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition-all ${mode === 'signin' ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}
            >
              Entrar
            </button>
            <button
              onClick={() => setMode('signup')}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition-all ${mode === 'signup' ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}
            >
              Criar conta
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <Input label="Nome completo" value={name} onChange={setName} required placeholder="Seu nome" />
            )}
            <Input label="E-mail" type="email" value={email} onChange={setEmail} required placeholder="email@exemplo.com" />
            <Input
              label="Senha"
              type="password"
              value={password}
              onChange={setPassword}
              required
              placeholder="••••••••"
              showPasswordToggle
            />
            {mode === 'signup' && (
              <Select
                label="Perfil"
                value={role}
                onChange={setRole}
                options={Object.entries(ROLE_LABELS).map(([v, l]) => ({ value: v, label: l }))}
              />
            )}

            {error && (
              <div className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-600 dark:bg-rose-950/30 dark:text-rose-400">
                {error}
              </div>
            )}

            <Button type="submit" size="lg" className="w-full" disabled={loading}>
              {loading ? 'Carregando...' : mode === 'signin' ? 'Entrar' : 'Criar conta'}
            </Button>
          </form>

          <div className="mt-6 rounded-lg bg-slate-50 p-4 text-xs text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
            <p className="font-medium text-slate-600 dark:text-slate-300">Contas de demonstração:</p>
            <div className="mt-2 space-y-1">
              <p><span className="font-mono text-slate-700 dark:text-slate-300">admin@fieldcontrol.com.br</span> / admin123</p>
              <p><span className="font-mono text-slate-700 dark:text-slate-300">gestor@fieldcontrol.com.br</span> / gestor123</p>
              <p><span className="font-mono text-slate-700 dark:text-slate-300">tecnico@fieldcontrol.com.br</span> / tecnico123</p>
              <p><span className="font-mono text-slate-700 dark:text-slate-300">financeiro@fieldcontrol.com.br</span> / fin123</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
