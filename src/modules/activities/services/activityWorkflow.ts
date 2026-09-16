import { supabase } from '@/lib/supabase';
import type { ActivityStatus } from '@/types';
import { enqueueOfflineAction } from '@/modules/offline/services/offlineQueue.service';

export const ACTIVITY_TRANSITIONS: Record<ActivityStatus, ActivityStatus[]> = {
  planejada: ['em_deslocamento', 'cancelada'],
  em_deslocamento: ['em_andamento', 'planejada', 'cancelada'],
  em_andamento: ['pausada', 'aguardando_validacao', 'cancelada'],
  pausada: ['em_andamento', 'cancelada'],
  aguardando_validacao: ['concluida', 'em_andamento'],
  concluida: [],
  cancelada: [],
};

export function canTransition(from: ActivityStatus, to: ActivityStatus) {
  return ACTIVITY_TRANSITIONS[from]?.includes(to) ?? false;
}

export async function changeActivityStatus(id: string, from: ActivityStatus, to: ActivityStatus, description?: string) {
  if (!canTransition(from, to)) throw new Error('Transição de status não permitida.');
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { status: to };
  if (to === 'em_andamento' && !['em_andamento', 'pausada'].includes(from)) patch.started_at = now;
  if (to === 'concluida') patch.finished_at = now;
  if (!navigator.onLine) { await enqueueOfflineAction({ type: 'activity_status', payload: { activityId: id, update: patch } }); return; }
  const { error } = await supabase.from('activities').update(patch).eq('id', id);
  if (error) throw error;
  const { data: auth } = await supabase.auth.getUser();
  const { error: historyError } = await supabase.from('activity_history').insert({
    activity_id: id,
    previous_status: from,
    new_status: to,
    user_id: auth.user?.id ?? null,
    description: description ?? null,
  });
  if (historyError) console.warn('Status alterado, mas o histórico não foi registrado:', historyError.message);
}
