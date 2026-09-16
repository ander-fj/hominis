import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { flushOfflineQueue, getOfflineQueueCount } from '@/modules/offline/services/offlineQueue.service';

type OfflineContextValue = { online: boolean; pending: number; syncing: boolean; syncNow: () => Promise<void> };
const OfflineContext = createContext<OfflineContextValue | null>(null);

export function OfflineProvider({ children }: { children: React.ReactNode }) {
  const [online, setOnline] = useState(navigator.onLine);
  const [pending, setPending] = useState(0); const [syncing, setSyncing] = useState(false);
  const refresh = useCallback(async () => setPending(await getOfflineQueueCount()), []);
  const syncNow = useCallback(async () => { setSyncing(true); try { await flushOfflineQueue(); await refresh(); } finally { setSyncing(false); } }, [refresh]);
  useEffect(() => { refresh(); const onOnline=()=>{setOnline(true); syncNow();}; const onOffline=()=>setOnline(false); window.addEventListener('online',onOnline); window.addEventListener('offline',onOffline); return()=>{window.removeEventListener('online',onOnline);window.removeEventListener('offline',onOffline);}; }, [refresh,syncNow]);
  return <OfflineContext.Provider value={{online,pending,syncing,syncNow}}>{children}</OfflineContext.Provider>;
}
export function useOffline() { const ctx=useContext(OfflineContext); if(!ctx) throw new Error('useOffline deve ser usado dentro de OfflineProvider'); return ctx; }
