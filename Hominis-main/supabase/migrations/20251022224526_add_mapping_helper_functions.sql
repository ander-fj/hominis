-- Funções auxiliares para gerenciar relacionamento muitos-para-muitos
--
-- 1. Função para sincronizar mapeamento quando dados são inseridos
-- 2. Função para buscar todos os dados de um colaborador pelo identificador
-- 3. Triggers para atualizar automaticamente os arrays de IDs

-- Função para adicionar/atualizar mapeamento de colaborador
CREATE OR REPLACE FUNCTION sync_employee_mapping(
  p_identifier text,
  p_employee_id uuid DEFAULT NULL
) RETURNS uuid AS $$
DECLARE
  v_mapping_id uuid;
BEGIN
  -- Insert or update employee_data_mapping
  INSERT INTO employee_data_mapping (employee_identifier, employee_id)
  VALUES (p_identifier, p_employee_id)
  ON CONFLICT (employee_identifier) 
  DO UPDATE SET 
    employee_id = COALESCE(EXCLUDED.employee_id, employee_data_mapping.employee_id),
    updated_at = now()
  RETURNING id INTO v_mapping_id;
  
  RETURN v_mapping_id;
END;
$$ LANGUAGE plpgsql;

-- Função para adicionar ID de registro de presença
CREATE OR REPLACE FUNCTION add_attendance_to_mapping(
  p_employee_id uuid,
  p_attendance_id uuid
) RETURNS void AS $$
BEGIN
  UPDATE employee_data_mapping
  SET 
    attendance_record_ids = array_append(
      COALESCE(attendance_record_ids, '{}'), 
      p_attendance_id
    ),
    updated_at = now()
  WHERE employee_id = p_employee_id;
END;
$$ LANGUAGE plpgsql;

-- Função para adicionar ID de treinamento
CREATE OR REPLACE FUNCTION add_training_to_mapping(
  p_employee_id uuid,
  p_training_id uuid
) RETURNS void AS $$
BEGIN
  UPDATE employee_data_mapping
  SET 
    training_ids = array_append(
      COALESCE(training_ids, '{}'), 
      p_training_id
    ),
    updated_at = now()
  WHERE employee_id = p_employee_id;
END;
$$ LANGUAGE plpgsql;

-- Função para adicionar ID de EPI
CREATE OR REPLACE FUNCTION add_ppe_to_mapping(
  p_employee_id uuid,
  p_ppe_id uuid
) RETURNS void AS $$
BEGIN
  UPDATE employee_data_mapping
  SET 
    ppe_ids = array_append(
      COALESCE(ppe_ids, '{}'), 
      p_ppe_id
    ),
    updated_at = now()
  WHERE employee_id = p_employee_id;
END;
$$ LANGUAGE plpgsql;

-- Função para adicionar ID de exame médico
CREATE OR REPLACE FUNCTION add_medical_exam_to_mapping(
  p_employee_id uuid,
  p_exam_id uuid
) RETURNS void AS $$
BEGIN
  UPDATE employee_data_mapping
  SET 
    medical_exam_ids = array_append(
      COALESCE(medical_exam_ids, '{}'), 
      p_exam_id
    ),
    updated_at = now()
  WHERE employee_id = p_employee_id;
END;
$$ LANGUAGE plpgsql;

-- Função para adicionar ID de incidente
CREATE OR REPLACE FUNCTION add_incident_to_mapping(
  p_employee_id uuid,
  p_incident_id uuid
) RETURNS void AS $$
BEGIN
  UPDATE employee_data_mapping
  SET 
    incident_ids = array_append(
      COALESCE(incident_ids, '{}'), 
      p_incident_id
    ),
    updated_at = now()
  WHERE employee_id = p_employee_id;
END;
$$ LANGUAGE plpgsql;

-- Função para adicionar ID de férias
CREATE OR REPLACE FUNCTION add_vacation_to_mapping(
  p_employee_id uuid,
  p_vacation_id uuid
) RETURNS void AS $$
BEGIN
  UPDATE employee_data_mapping
  SET 
    vacation_ids = array_append(
      COALESCE(vacation_ids, '{}'), 
      p_vacation_id
    ),
    updated_at = now()
  WHERE employee_id = p_employee_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger para attendance_records
CREATE OR REPLACE FUNCTION trigger_sync_attendance_mapping()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM add_attendance_to_mapping(NEW.employee_id, NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_attendance_mapping ON attendance_records;
CREATE TRIGGER sync_attendance_mapping
  AFTER INSERT ON attendance_records
  FOR EACH ROW
  EXECUTE FUNCTION trigger_sync_attendance_mapping();

-- Trigger para sst_trainings
CREATE OR REPLACE FUNCTION trigger_sync_training_mapping()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM add_training_to_mapping(NEW.employee_id, NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_training_mapping ON sst_trainings;
CREATE TRIGGER sync_training_mapping
  AFTER INSERT ON sst_trainings
  FOR EACH ROW
  EXECUTE FUNCTION trigger_sync_training_mapping();

-- Trigger para sst_ppe
CREATE OR REPLACE FUNCTION trigger_sync_ppe_mapping()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM add_ppe_to_mapping(NEW.employee_id, NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_ppe_mapping ON sst_ppe;
CREATE TRIGGER sync_ppe_mapping
  AFTER INSERT ON sst_ppe
  FOR EACH ROW
  EXECUTE FUNCTION trigger_sync_ppe_mapping();

-- Trigger para sst_medical_exams
CREATE OR REPLACE FUNCTION trigger_sync_medical_exam_mapping()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM add_medical_exam_to_mapping(NEW.employee_id, NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_medical_exam_mapping ON sst_medical_exams;
CREATE TRIGGER sync_medical_exam_mapping
  AFTER INSERT ON sst_medical_exams
  FOR EACH ROW
  EXECUTE FUNCTION trigger_sync_medical_exam_mapping();

-- Trigger para sst_incidents
CREATE OR REPLACE FUNCTION trigger_sync_incident_mapping()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM add_incident_to_mapping(NEW.employee_id, NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_incident_mapping ON sst_incidents;
CREATE TRIGGER sync_incident_mapping
  AFTER INSERT ON sst_incidents
  FOR EACH ROW
  EXECUTE FUNCTION trigger_sync_incident_mapping();

-- Trigger para vacation_records
CREATE OR REPLACE FUNCTION trigger_sync_vacation_mapping()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM add_vacation_to_mapping(NEW.employee_id, NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_vacation_mapping ON vacation_records;
CREATE TRIGGER sync_vacation_mapping
  AFTER INSERT ON vacation_records
  FOR EACH ROW
  EXECUTE FUNCTION trigger_sync_vacation_mapping();