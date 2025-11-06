/*
  # Função para limpar todos os dados do sistema

  1. Nova função
    - `truncate_all_data()`: Limpa todas as tabelas do sistema na ordem correta
    
  2. Segurança
    - Deleta tabelas filhas antes das tabelas pais
    - Respeita foreign key constraints
    - Retorna status de cada operação
*/

CREATE OR REPLACE FUNCTION truncate_all_data()
RETURNS TABLE (
  table_name text,
  rows_deleted bigint,
  status text
) AS $$
DECLARE
  deleted_count bigint;
BEGIN
  -- Tabelas filhas primeiro (respeitando foreign keys)
  
  -- employee_scores
  DELETE FROM employee_scores;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  table_name := 'employee_scores';
  rows_deleted := deleted_count;
  status := 'success';
  RETURN NEXT;
  
  -- employee_rankings
  DELETE FROM employee_rankings;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  table_name := 'employee_rankings';
  rows_deleted := deleted_count;
  status := 'success';
  RETURN NEXT;
  
  -- attendance_records
  DELETE FROM attendance_records;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  table_name := 'attendance_records';
  rows_deleted := deleted_count;
  status := 'success';
  RETURN NEXT;
  
  -- sst_trainings
  DELETE FROM sst_trainings;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  table_name := 'sst_trainings';
  rows_deleted := deleted_count;
  status := 'success';
  RETURN NEXT;
  
  -- sst_ppe
  DELETE FROM sst_ppe;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  table_name := 'sst_ppe';
  rows_deleted := deleted_count;
  status := 'success';
  RETURN NEXT;
  
  -- sst_medical_exams
  DELETE FROM sst_medical_exams;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  table_name := 'sst_medical_exams';
  rows_deleted := deleted_count;
  status := 'success';
  RETURN NEXT;
  
  -- sst_incidents
  DELETE FROM sst_incidents;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  table_name := 'sst_incidents';
  rows_deleted := deleted_count;
  status := 'success';
  RETURN NEXT;
  
  -- vacation_records
  DELETE FROM vacation_records;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  table_name := 'vacation_records';
  rows_deleted := deleted_count;
  status := 'success';
  RETURN NEXT;
  
  -- employee_comments
  DELETE FROM employee_comments;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  table_name := 'employee_comments';
  rows_deleted := deleted_count;
  status := 'success';
  RETURN NEXT;
  
  -- employees (tabela pai por último)
  DELETE FROM employees;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  table_name := 'employees';
  rows_deleted := deleted_count;
  status := 'success';
  RETURN NEXT;
  
  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;