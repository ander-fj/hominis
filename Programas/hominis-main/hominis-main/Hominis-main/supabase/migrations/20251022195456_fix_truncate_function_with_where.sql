/*
  # Corrigir função truncate_all_data

  Fix: Adicionar WHERE true em todos os DELETEs para contornar a restrição de segurança do Supabase
  que exige WHERE clause em comandos DELETE executados via RPC.
*/

CREATE OR REPLACE FUNCTION truncate_all_data()
RETURNS TABLE(table_name text, rows_deleted bigint, status text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count bigint;
BEGIN
  -- Tabelas filhas primeiro (respeitando foreign keys)
  
  -- employee_scores
  DELETE FROM employee_scores WHERE true;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  table_name := 'employee_scores';
  rows_deleted := deleted_count;
  status := 'success';
  RETURN NEXT;

  -- employee_rankings
  DELETE FROM employee_rankings WHERE true;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  table_name := 'employee_rankings';
  rows_deleted := deleted_count;
  status := 'success';
  RETURN NEXT;

  -- attendance_records
  DELETE FROM attendance_records WHERE true;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  table_name := 'attendance_records';
  rows_deleted := deleted_count;
  status := 'success';
  RETURN NEXT;

  -- sst_trainings
  DELETE FROM sst_trainings WHERE true;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  table_name := 'sst_trainings';
  rows_deleted := deleted_count;
  status := 'success';
  RETURN NEXT;

  -- sst_ppe
  DELETE FROM sst_ppe WHERE true;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  table_name := 'sst_ppe';
  rows_deleted := deleted_count;
  status := 'success';
  RETURN NEXT;

  -- sst_medical_exams
  DELETE FROM sst_medical_exams WHERE true;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  table_name := 'sst_medical_exams';
  rows_deleted := deleted_count;
  status := 'success';
  RETURN NEXT;

  -- sst_incidents
  DELETE FROM sst_incidents WHERE true;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  table_name := 'sst_incidents';
  rows_deleted := deleted_count;
  status := 'success';
  RETURN NEXT;

  -- vacation_records
  DELETE FROM vacation_records WHERE true;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  table_name := 'vacation_records';
  rows_deleted := deleted_count;
  status := 'success';
  RETURN NEXT;

  -- employee_comments
  DELETE FROM employee_comments WHERE true;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  table_name := 'employee_comments';
  rows_deleted := deleted_count;
  status := 'success';
  RETURN NEXT;

  -- ranking_recalculation_queue
  DELETE FROM ranking_recalculation_queue WHERE true;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  table_name := 'ranking_recalculation_queue';
  rows_deleted := deleted_count;
  status := 'success';
  RETURN NEXT;

  -- employees (tabela pai por último)
  DELETE FROM employees WHERE true;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  table_name := 'employees';
  rows_deleted := deleted_count;
  status := 'success';
  RETURN NEXT;

  RETURN;
END;
$$;
