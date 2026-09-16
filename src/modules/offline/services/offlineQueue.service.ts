import { supabase } from '@/lib/supabase';

export type FieldEventPayload = {
  activity_id: string;
  user_id: string | null;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  event_type: string;
};

export type ActivityStatusPayload = {
  activityId: string;
  update: Record<string, unknown>;
};

export type ChecklistUpdatePayload = {
  responseId: string;
  update: { checked: boolean; updated_at: string };
};

type OfflineAction =
  | { id: string; type: 'field_event'; payload: FieldEventPayload; createdAt: string }
  | { id: string; type: 'activity_status'; payload: ActivityStatusPayload; createdAt: string }
  | { id: string; type: 'checklist_update'; payload: ChecklistUpdatePayload; createdAt: string };

const DB_NAME = 'fieldcontrol-offline';
const STORE = 'queue';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'id' });
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

export async function enqueueOfflineAction(action: Omit<OfflineAction, 'id' | 'createdAt'>) {
  const db = await openDb();
  const item: OfflineAction = { ...action, id: crypto.randomUUID(), createdAt: new Date().toISOString() } as OfflineAction;
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(item);
    tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error);
  });
  db.close();
  return item;
}

export async function getOfflineQueue(): Promise<OfflineAction[]> {
  const db = await openDb();
  const items = await new Promise<OfflineAction[]>((resolve, reject) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result as OfflineAction[]); req.onerror = () => reject(req.error);
  });
  db.close();
  return items.sort((a,b) => a.createdAt.localeCompare(b.createdAt));
}

async function remove(id: string) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => { const tx=db.transaction(STORE,'readwrite'); tx.objectStore(STORE).delete(id); tx.oncomplete=()=>resolve(); tx.onerror=()=>reject(tx.error); });
  db.close();
}

export async function getOfflineQueueCount() { return (await getOfflineQueue()).length; }

export async function flushOfflineQueue() {
  if (!navigator.onLine) return { synced: 0, pending: await getOfflineQueueCount() };
  const queue = await getOfflineQueue(); let synced = 0;
  for (const action of queue) {
    try {
      if (action.type === 'field_event') {
        const { error } = await supabase.from('activity_locations').insert(action.payload);
        if (error) throw error;
      } else if (action.type === 'activity_status') {
        const { activityId, update } = action.payload;
        const { error } = await supabase.from('activities').update(update).eq('id', activityId);
        if (error) throw error;
      } else if (action.type === 'checklist_update') {
        const { responseId, update } = action.payload;
        const { error } = await supabase.from('activity_checklist_responses').update(update).eq('id', responseId);
        if (error) throw error;
      }
      await remove(action.id); synced++;
    } catch { break; }
  }
  return { synced, pending: await getOfflineQueueCount() };
}
