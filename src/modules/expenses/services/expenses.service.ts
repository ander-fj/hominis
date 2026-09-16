import { supabase } from '@/lib/supabase';

export type ExpenseStatus = 'draft' | 'pending' | 'under_review' | 'approved' | 'rejected' | 'paid';
export interface Expense { id:string; activity_id:string|null; project_id:string|null; user_id:string; category:string; description:string; amount:number; status:ExpenseStatus; receipt_url:string|null; expense_date:string; created_at:string; updated_at:string; }
export async function listExpenses(){ const {data,error}=await supabase.from('expenses').select('*').order('expense_date',{ascending:false}); if(error) throw error; return data as Expense[]; }
export async function updateExpenseStatus(id:string,status:ExpenseStatus,approved_amount?:number,comments?:string){ const {error}=await supabase.from('expenses').update({status, approved_amount, approval_comments:comments, updated_at:new Date().toISOString()}).eq('id',id); if(error) throw error; }
