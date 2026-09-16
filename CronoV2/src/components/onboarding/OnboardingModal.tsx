import { useEffect, useState } from 'react';
import { CheckCircle2, ChevronLeft, ChevronRight, X } from 'lucide-react';

const STEPS = [
  { title: 'Bem-vindo ao FieldControl', text: 'Organize obras, atividades, despesas, veículos e a operação de campo em um único lugar.' },
  { title: 'Comece pelo que importa', text: 'Técnicos executam atividades. Gestores acompanham a operação. Financeiro controla despesas e relatórios.' },
  { title: 'Pronto para trabalhar', text: 'Use o menu para navegar e mantenha o status das atividades sempre atualizado para alimentar os indicadores.' },
];

export function OnboardingModal() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  useEffect(() => { setOpen(localStorage.getItem('fieldcontrol-onboarding-done') !== 'true'); }, []);
  const close = () => { localStorage.setItem('fieldcontrol-onboarding-done', 'true'); setOpen(false); };
  if (!open) return null;
  const current = STEPS[step];
  return <div className="fixed inset-0 z-[100] flex items-end bg-slate-950/45 p-4 backdrop-blur-sm sm:items-center sm:justify-center">
    <section className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900">
      <div className="flex items-start justify-between"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 text-amber-700"><CheckCircle2 /></div><button onClick={close} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Fechar"><X size={20}/></button></div>
      <div className="mt-6"><p className="text-xs font-bold uppercase tracking-wider text-amber-600">Passo {step + 1} de {STEPS.length}</p><h2 className="mt-2 text-xl font-bold text-slate-900 dark:text-white">{current.title}</h2><p className="mt-3 leading-6 text-slate-600 dark:text-slate-300">{current.text}</p></div>
      <div className="mt-7 flex items-center justify-between"><button disabled={step===0} onClick={()=>setStep(step-1)} className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-30"><ChevronLeft size={18}/> Voltar</button>{step < STEPS.length-1 ? <button onClick={()=>setStep(step+1)} className="inline-flex items-center gap-1 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white">Avançar <ChevronRight size={18}/></button> : <button onClick={close} className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white">Começar</button>}</div>
    </section></div>;
}
