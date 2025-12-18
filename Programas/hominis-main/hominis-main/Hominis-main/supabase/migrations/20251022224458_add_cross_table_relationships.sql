-- Relacionamento Muitos-para-Muitos baseado na Coluna A
--
-- 1. Nova Tabela
--   - employee_data_mapping
--     - id (uuid, primary key)
--     - employee_identifier (text) - valor da coluna A das planilhas
--     - employee_id (uuid) - FK para employees
--     - attendance_record_ids (uuid[]) - array de IDs de attendance_records
--     - training_ids (uuid[]) - array de IDs de trainings
--     - ppe_ids (uuid[]) - array de IDs de EPIs
--     - medical_exam_ids (uuid[]) - array de IDs de exames
--     - incident_ids (uuid[]) - array de IDs de incidentes
--     - vacation_ids (uuid[]) - array de IDs de férias
--     - created_at (timestamp)
--     - updated_at (timestamp)
--
-- 2. Security
--   - Enable RLS on employee_data_mapping table
--   - Add policies for authenticated and anonymous users to access data
--
-- 3. Notas
--   - Esta tabela centraliza o relacionamento entre o identificador da coluna A
--     (nome/email do colaborador) e todos os registros relacionados nas diferentes tabelas
--   - Permite rastreamento completo de todos os dados de um colaborador através
--     de um único identificador de referência

-- Create employee_data_mapping table
CREATE TABLE IF NOT EXISTS employee_data_mapping (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_identifier text NOT NULL UNIQUE,
  employee_id uuid REFERENCES employees(id) ON DELETE CASCADE,
  attendance_record_ids uuid[] DEFAULT '{}',
  training_ids uuid[] DEFAULT '{}',
  ppe_ids uuid[] DEFAULT '{}',
  medical_exam_ids uuid[] DEFAULT '{}',
  incident_ids uuid[] DEFAULT '{}',
  vacation_ids uuid[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE employee_data_mapping ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow anonymous and authenticated to read employee_data_mapping"
  ON employee_data_mapping
  FOR SELECT
  USING (true);

CREATE POLICY "Allow anonymous and authenticated to insert employee_data_mapping"
  ON employee_data_mapping
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow anonymous and authenticated to update employee_data_mapping"
  ON employee_data_mapping
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anonymous and authenticated to delete employee_data_mapping"
  ON employee_data_mapping
  FOR DELETE
  USING (true);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_employee_data_mapping_identifier 
  ON employee_data_mapping(employee_identifier);

CREATE INDEX IF NOT EXISTS idx_employee_data_mapping_employee_id 
  ON employee_data_mapping(employee_id);