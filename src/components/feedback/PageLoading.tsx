import { Spinner } from '@/components/ui';
export function PageLoading({ label = 'Carregando...' }: { label?: string }) { return <div className="flex min-h-[280px] flex-col items-center justify-center gap-3" role="status"><Spinner /><span className="text-sm text-slate-500">{label}</span></div>; }
