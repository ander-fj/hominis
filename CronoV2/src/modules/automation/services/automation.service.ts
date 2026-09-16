import { supabase } from '@/lib/supabase';
export type AutomationStatus = 'pending'|'processed'|'failed';
export interface AutomationRule { id:string; name:string; event_type:string; condition_config:Record<string,unknown>; action_config:Record<string,unknown>; active:boolean; created_at:string; }
export const automationService = {
  async listRules(){ const {data,error}=await supabase.from('automation_rules').select('*').order('created_at',{ascending:false}); if(error) throw error; return (data??[]) as AutomationRule[]; },
  async toggleRule(id:string, active:boolean){ const {error}=await supabase.from('automation_rules').update({active}).eq('id',id); if(error) throw error; },
  async runHealthCheck(){ const {data,error}=await supabase.rpc('run_operational_health_check'); if(error) throw error; return data as {alerts_created:number}|null; },
  async runBackgroundJob(){ const {data,error}=await supabase.rpc('run_operational_health_check_job'); if(error) throw error; return data as {run_id:string;status:'SUCCESS'|'FAILED';result?:{alerts_created:number};error?:string}; },
  async listRuns(){ const {data,error}=await supabase.from('automation_runs').select('*').order('started_at',{ascending:false}).limit(20); if(error) throw error; return data??[]; },
};
