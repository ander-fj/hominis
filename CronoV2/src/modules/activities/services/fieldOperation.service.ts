import { supabase } from '@/lib/supabase';
import { changeActivityStatus } from './activityWorkflow';
import { enqueueOfflineAction } from '@/modules/offline/services/offlineQueue.service';
import type { ActivityStatus } from '@/types';

type Position = { latitude: number; longitude: number; accuracy?: number | null };

export async function registerFieldEvent(activityId: string, eventType: string, position: Position | null) {
  const { data: auth } = await supabase.auth.getUser();
  const payload = {
    activity_id: activityId,
    user_id: auth.user?.id ?? null,
    latitude: position?.latitude ?? null,
    longitude: position?.longitude ?? null,
    accuracy: position?.accuracy ?? null,
    event_type: eventType,
  };
  if (!navigator.onLine) { await enqueueOfflineAction({ type: 'field_event', payload }); return; }
  const { error } = await supabase.from('activity_locations').insert(payload);
  if (error) throw error;
}

export async function executeFieldTransition(activityId: string, from: ActivityStatus, to: ActivityStatus, eventType: string, position: Position | null, description?: string) {
  await registerFieldEvent(activityId, eventType, position);
  await changeActivityStatus(activityId, from, to, description);
}
