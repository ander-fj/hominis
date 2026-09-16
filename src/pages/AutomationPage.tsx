import { useCallback, useEffect, useState } from 'react';
import { Bot, Play, RefreshCw, Power } from 'lucide-react';
import { automationService, type AutomationRule } from '@/modules/automation/services/automation.service';
import { Button, Spinner } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';

export function AutomationPage() {
  const { profile } = useAuth();
  // RLS: leitura liberada para admin/gestor, mas apenas admin pode atualizar regras (automation_rules_admin_write).
  const isAdmin = profile?.role === 'admin';
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRules(await automationService.listRules());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar as regras de automação.');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const run = async () => {
    setRunning(true);
    setMessage(null);
    try {
      const r = await automationService.runHealthCheck();
      setMessage(`Verificação concluída. ${r?.alerts_created ?? 0} alerta(s) criado(s).`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Falha na automação');
    } finally {
      setRunning(false);
    }
  };

  const toggle = async (rule: AutomationRule) => {
    if (!isAdmin) return;
    await automationService.toggleRule(rule.id, !rule.active);
    setRules((v) => v.map((x) => (x.id === rule.id ? { ...x, active: !x.active } : x)));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Automação inteligente</h1>
          <p className="text-sm text-slate-500">Regras proativas para identificar riscos antes que afetem a operação.</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={load}><RefreshCw size={16} /> Atualizar</Button>
          <Button onClick={run} disabled={running}>{running ? <Spinner /> : <Play size={16} />} Executar verificação</Button>
        </div>
      </div>
      {message && <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-blue-700">{message}</div>}
      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-700">{error}</div>}
      {loading
        ? <div className="py-16 flex justify-center"><Spinner /></div>
        : <div className="grid gap-4 lg:grid-cols-2">
            {rules.map((rule) => (
              <div key={rule.id} className="rounded-xl border bg-white p-5 shadow-sm">
                <div className="flex justify-between gap-4">
                  <div>
                    <div className="mb-2 flex items-center gap-2"><Bot size={18} /><h3 className="font-semibold">{rule.name}</h3></div>
                    <p className="text-sm text-slate-500">Evento: {rule.event_type}</p>
                  </div>
                  <button
                    className={`rounded-full px-3 py-1 text-xs font-bold ${rule.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'} ${isAdmin ? '' : 'cursor-not-allowed opacity-60'}`}
                    disabled={!isAdmin}
                    title={isAdmin ? 'Alternar regra' : 'Apenas administradores podem alterar regras.'}
                    onClick={() => toggle(rule)}
                  >
                    <Power size={13} className="inline mr-1" />
                    {rule.active ? 'Ativa' : 'Inativa'}
                  </button>
                </div>
              </div>
            ))}
          </div>}
    </div>
  );
}
