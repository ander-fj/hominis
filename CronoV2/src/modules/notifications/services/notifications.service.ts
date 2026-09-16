import { supabase } from '@/lib/supabase';

export type NotificationLevel = 'info' | 'warning' | 'critical' | 'success';
export interface AppNotification { id:string; user_id:string; title:string; message:string; level:NotificationLevel; entity_type:string|null; entity_id:string|null; read_at:string|null; created_at:string; }

export const notificationsService = {
  async list(userId:string, limit=50) {
    const { data, error } = await supabase.from('notifications').select('*').eq('user_id', userId).order('created_at',{ascending:false}).limit(limit);
    if (error) throw error; return (data ?? []) as AppNotification[];
  },
  async unreadCount(userId:string) {
    const { count, error } = await supabase.from('notifications').select('*',{count:'exact',head:true}).eq('user_id',userId).is('read_at',null);
    if (error) throw error; return count ?? 0;
  },
  async markRead(id:string) { const {error}=await supabase.from('notifications').update({read_at:new Date().toISOString()}).eq('id',id); if(error) throw error; },
  async markAllRead(userId:string) { const {error}=await supabase.from('notifications').update({read_at:new Date().toISOString()}).eq('user_id',userId).is('read_at',null); if(error) throw error; },
};
