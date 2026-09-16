import { useEffect, useState } from 'react';
import { ShieldCheck, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { runSystemAudit, type SystemAuditResult } from '@/modules/quality/services/systemAudit.service';

export function QualityPage() {
  const [items, setItems] = useState<SystemAuditResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = async () => { setLoading(true); setError(''); try { setItems(await runSystemAudit()); } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível executar a auditoria.'); } finally { setLoading(false); } };
  useEffect(() => { void load(); }, []);
  const critical = items.filter(i => i.severity === 'critical').length;
  return <div className="space-y-6 p-4 md:p-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-bold">Qualidade e Auditoria</h1><p className="text-sm text-slate-500">Verificação operacional e indicadores de saúde do sistema.</p></div><button onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"><RefreshCw size={16} className={loading ? 'animate-spin' : ''}/>Atualizar auditoria</button></div>
    {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
    <div className="grid gap-4 md:grid-cols-3">{items.map(item => <div key={item.label} className="rounded-xl border bg-white p-5 shadow-sm dark:bg-slate-900"><div className="flex items-start justify-between"><div><p className="text-sm text-slate-500">{item.label}</p><p className="mt-2 text-3xl font-bold">{item.value}</p></div>{item.severity === 'ok' ? <CheckCircle2 className="text-emerald-500"/> : <AlertTriangle className="text-amber-500"/>}</div><p className="mt-3 text-xs text-slate-500">{item.detail}</p></div>)}</div>
    <div className="rounded-xl border bg-white p-5 shadow-sm dark:bg-slate-900"><div className="flex items-center gap-2"><ShieldCheck size={20}/><h2 className="font-semibold">Resultado da auditoria</h2></div><p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{loading ? 'Executando verificações...' : critical > 0 ? `${critical} ponto(s) crítico(s) requer(em) atenção.` : 'Nenhuma inconsistência crítica encontrada nos indicadores verificados.'}</p></div>
  </div>;
}
