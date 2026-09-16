import { supabase } from '@/lib/supabase';
import type { Activity, ActivityStatus, Profile, Project, WorkOrder } from '@/types';

export type ActivityWithRelations = Activity & { project: Project | null; responsible: Profile | null; work_order: WorkOrder | null };
export interface ActivityFilters { search?: string; status?: ActivityStatus | ''; page?: number; pageSize?: number; }

export async function getActivities(filters: ActivityFilters = {}) {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 50;
  let query = supabase.from('activities')
    .select('*, project:projects(*), responsible:profiles(*), work_order:work_orders(*)', { count: 'exact' })
    .order('created_at', { ascending: false });

  if (filters.status) query = query.eq('status', filters.status);
  if (filters.search?.trim()) {
    const term = filters.search.trim().replace(/,/g, ' ');
    query = query.or(`title.ilike.%${term}%,number.ilike.%${term}%`);
  }

  const from = (page - 1) * pageSize;
  const { data, error, count } = await query.range(from, from + pageSize - 1);
  if (error) throw error;
  return { data: (data as ActivityWithRelations[]) ?? [], count: count ?? 0 };
}

export async function createActivity(activity: Partial<Activity>) {
  const { data, error } = await supabase.from('activities').insert(activity).select().single();
  if (error) throw error;
  return data as Activity;
}
export async function updateActivity(id: string, activity: Partial<Activity>) {
  const { data, error } = await supabase.from('activities').update(activity).eq('id', id).select().single();
  if (error) throw error;
  return data as Activity;
}
export async function deleteActivity(id: string) {
  const { error } = await supabase.from('activities').delete().eq('id', id);
  if (error) throw error;
}
