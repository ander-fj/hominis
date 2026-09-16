import { supabase } from '@/lib/supabase';
import { enqueueOfflineAction } from '@/modules/offline/services/offlineQueue.service';

export type ChecklistResponse = { id: string; item_id: string; checked: boolean; notes: string | null; checklist_item?: { description: string; required: boolean; position: number } };
export type Evidence = { id: string; type: 'FOTO_ANTES'|'FOTO_DURANTE'|'FOTO_DEPOIS'|'DOCUMENTO'|'COMPROVANTE'; description: string|null; file_path: string; created_at: string };

export async function loadActivityChecklist(activityId: string) {
  const { data, error } = await supabase.from('activity_checklist_responses')
    .select('id,item_id,checked,notes,checklist_item:checklist_items(description,required,position)')
    .eq('activity_id', activityId)
    .order('created_at');
  if (error) throw error;
  // O cliente Supabase sem tipos gerados infere relacionamentos incorporados como arrays,
  // mas em runtime `checklist_items` chega como objeto único (relação many-to-one via item_id).
  return (data ?? []) as unknown as ChecklistResponse[];
}

export async function toggleChecklistResponse(responseId: string, checked: boolean) {
  const update = { checked, updated_at: new Date().toISOString() };
  if (!navigator.onLine) { await enqueueOfflineAction({ type: 'checklist_update', payload: { responseId, update } }); return; }
  const { error } = await supabase.from('activity_checklist_responses').update(update).eq('id', responseId);
  if (error) throw error;
}

export async function loadActivityEvidence(activityId: string) {
  const { data, error } = await supabase.from('activity_evidences').select('*').eq('activity_id', activityId).order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Evidence[];
}

export async function uploadActivityEvidence(activityId: string, type: Evidence['type'], file: File, description?: string) {
  const { data: auth } = await supabase.auth.getUser();
  const ext = file.name.split('.').pop() || 'jpg';
  const path = `${activityId}/${crypto.randomUUID()}.${ext}`;
  const { error: uploadError } = await supabase.storage.from('activity-evidences').upload(path, file, { upsert: false });
  if (uploadError) throw uploadError;
  const { error } = await supabase.from('activity_evidences').insert({ activity_id: activityId, type, file_path: path, description: description || null, created_by: auth.user?.id ?? null });
  if (error) throw error;
}

export async function validateActivityCompletion(activityId: string) {
  const responses = await loadActivityChecklist(activityId);
  const pending = responses.filter(r => r.checklist_item?.required && !r.checked);
  if (pending.length) throw new Error(`Existem ${pending.length} item(ns) obrigatório(s) do checklist pendente(s).`);
}
