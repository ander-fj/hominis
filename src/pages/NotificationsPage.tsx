import { useCallback, useEffect, useState } from 'react';
import { Bell, CheckCheck, AlertTriangle, Info, CheckCircle2, RefreshCw } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { notificationsService, type AppNotification } from '@/modules/notifications/services/notifications.service';
import { Button, Spinner } from '@/components/ui';

export function NotificationsPage(){
 const { profile }=useAuth(); const [items,setItems]=useState<AppNotification[]>([]); const [loading,setLoading]=useState(true); const [error,setError]=useState<string|null>(null);
 const load=useCallback(async()=>{ if(!profile?.id)return; setLoading(true); setError(null); try{setItems(await notificationsService.list(profile.id));}catch(e){setError(e instanceof Error?e.message:'Não foi possível carregar notificações');}finally{setLoading(false);} },[profile?.id]);
 useEffect(()=>{load();},[load]);
 const markAll=async()=>{if(!profile?.id)return; await notificationsService.markAllRead(profile.id); await load();};
 const icon=(level:string)=>level==='critical'?<AlertTriangle className="text-rose-600"/>:level==='warning'?<AlertTriangle className="text-amber-500"/>:level==='success'?<CheckCircle2 className="text-emerald-600"/>:<Info className="text-blue-600"/>;
 return <div className="space-y-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h1 className="text-2xl font-bold">Central de notificações</h1><p className="text-sm text-slate-500">Alertas operacionais e eventos que exigem atenção.</p></div><div className="flex gap-2"><Button onClick={load}><RefreshCw size={16}/> Atualizar</Button><Button onClick={markAll}><CheckCheck size={16}/> Marcar todas como lidas</Button></div></div>{loading?<div className="py-16 flex justify-center"><Spinner/></div>:error?<div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-700">{error}</div>:items.length===0?<div className="rounded-xl border bg-white p-12 text-center text-slate-500"><Bell className="mx-auto mb-3"/>Nenhuma notificação no momento.</div>:<div className="space-y-3">{items.map(n=><button key={n.id} onClick={async()=>{if(!n.read_at){await notificationsService.markRead(n.id);setItems(v=>v.map(x=>x.id===n.id?{...x,read_at:new Date().toISOString()}:x));}}} className={`w-full rounded-xl border p-4 text-left transition hover:shadow-sm ${n.read_at?'bg-white':'border-amber-200 bg-amber-50/40'}`}><div className="flex gap-3">{icon(n.level)}<div className="flex-1"><div className="flex justify-between gap-4"><h3 className="font-semibold">{n.title}</h3><span className="text-xs text-slate-400">{new Date(n.created_at).toLocaleString('pt-BR')}</span></div><p className="mt-1 text-sm text-slate-600">{n.message}</p></div></div></button>)}</div>}</div>;
}
