/*
  # HR and SST Management System - Initial Schema

  ## Overview
  This migration creates the complete database structure for an intelligent HR and SST management system
  with dynamic ranking capabilities, configurable evaluation criteria, and comprehensive safety tracking.

  ## New Tables

  ### 1. `employees`
  Core employee information
  - `id` (uuid, primary key)
  - `name` (text) - Full name
  - `email` (text, unique) - Email address
  - `department` (text) - Department/sector
  - `position` (text) - Job position
  - `hire_date` (date) - Date of hire
  - `active` (boolean) - Employment status
  - `created_at` (timestamptz) - Record creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### 2. `evaluation_criteria`
  Configurable evaluation criteria for ranking system
  - `id` (uuid, primary key)
  - `name` (text) - Criterion name (e.g., "Assiduidade")
  - `description` (text) - Detailed description
  - `data_type` (text) - Type: numeric, percentage, binary, score
  - `weight` (decimal) - Weight percentage (0-100)
  - `direction` (text) - "higher_better" or "lower_better"
  - `source` (text) - Data source: manual, sheets, calculated
  - `display_order` (integer) - Display order in UI
  - `active` (boolean) - Whether criterion is active
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 3. `employee_scores`
  Individual scores for each criterion per employee per period
  - `id` (uuid, primary key)
  - `employee_id` (uuid, foreign key to employees)
  - `criterion_id` (uuid, foreign key to evaluation_criteria)
  - `period` (date) - Evaluation period (month)
  - `raw_value` (decimal) - Raw score value
  - `normalized_score` (decimal) - Normalized score (0-100)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 4. `employee_rankings`
  Calculated overall rankings
  - `id` (uuid, primary key)
  - `employee_id` (uuid, foreign key to employees)
  - `period` (date) - Ranking period
  - `total_score` (decimal) - Weighted total score
  - `rank_position` (integer) - Rank position
  - `department` (text) - Department for filtering
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 5. `sst_trainings`
  Safety training records
  - `id` (uuid, primary key)
  - `employee_id` (uuid, foreign key to employees)
  - `training_name` (text)
  - `training_type` (text)
  - `completion_date` (date)
  - `expiry_date` (date)
  - `status` (text) - valid, expired, pending
  - `created_at` (timestamptz)

  ### 6. `sst_ppe` (Personal Protective Equipment)
  PPE delivery tracking
  - `id` (uuid, primary key)
  - `employee_id` (uuid, foreign key to employees)
  - `ppe_type` (text)
  - `delivery_date` (date)
  - `expiry_date` (date)
  - `status` (text) - delivered, pending, expired
  - `created_at` (timestamptz)

  ### 7. `sst_medical_exams`
  Medical examination tracking
  - `id` (uuid, primary key)
  - `employee_id` (uuid, foreign key to employees)
  - `exam_type` (text)
  - `exam_date` (date)
  - `next_exam_date` (date)
  - `status` (text) - valid, expired, scheduled
  - `result` (text)
  - `created_at` (timestamptz)

  ### 8. `sst_incidents`
  Safety incidents and accidents
  - `id` (uuid, primary key)
  - `employee_id` (uuid, foreign key to employees)
  - `incident_date` (date)
  - `incident_type` (text)
  - `severity` (text) - minor, moderate, severe, fatal
  - `description` (text)
  - `department` (text)
  - `days_lost` (integer)
  - `created_at` (timestamptz)

  ### 9. `attendance_records`
  Detailed attendance tracking
  - `id` (uuid, primary key)
  - `employee_id` (uuid, foreign key to employees)
  - `date` (date)
  - `status` (text) - present, absent, late, justified
  - `hours_worked` (decimal)
  - `delay_minutes` (integer)
  - `justification` (text)
  - `created_at` (timestamptz)

  ### 10. `sheets_sync_config`
  Google Sheets synchronization configuration
  - `id` (uuid, primary key)
  - `sheet_url` (text)
  - `sheet_name` (text)
  - `data_type` (text) - employees, attendance, sst, etc.
  - `last_sync` (timestamptz)
  - `sync_enabled` (boolean)
  - `created_at` (timestamptz)

  ## Security
  - RLS enabled on all tables
  - Policies for anonymous users to allow demo usage
*/

-- Create employees table
CREATE TABLE IF NOT EXISTS employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text UNIQUE NOT NULL,
  department text NOT NULL,
  position text NOT NULL,
  hire_date date NOT NULL DEFAULT CURRENT_DATE,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create evaluation_criteria table
CREATE TABLE IF NOT EXISTS evaluation_criteria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  data_type text NOT NULL CHECK (data_type IN ('numeric', 'percentage', 'binary', 'score')),
  weight decimal(5,2) NOT NULL CHECK (weight >= 0 AND weight <= 100),
  direction text NOT NULL CHECK (direction IN ('higher_better', 'lower_better')),
  source text NOT NULL CHECK (source IN ('manual', 'sheets', 'calculated')),
  display_order integer NOT NULL DEFAULT 0,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create employee_scores table
CREATE TABLE IF NOT EXISTS employee_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  criterion_id uuid NOT NULL REFERENCES evaluation_criteria(id) ON DELETE CASCADE,
  period date NOT NULL,
  raw_value decimal(10,2) NOT NULL,
  normalized_score decimal(5,2) DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(employee_id, criterion_id, period)
);

-- Create employee_rankings table
CREATE TABLE IF NOT EXISTS employee_rankings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  period date NOT NULL,
  total_score decimal(10,2) NOT NULL,
  rank_position integer NOT NULL,
  department text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(employee_id, period)
);

-- Create sst_trainings table
CREATE TABLE IF NOT EXISTS sst_trainings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  training_name text NOT NULL,
  training_type text NOT NULL,
  completion_date date NOT NULL,
  expiry_date date,
  status text NOT NULL CHECK (status IN ('valid', 'expired', 'pending')),
  created_at timestamptz DEFAULT now()
);

-- Create sst_ppe table
CREATE TABLE IF NOT EXISTS sst_ppe (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  ppe_type text NOT NULL,
  delivery_date date NOT NULL,
  expiry_date date,
  status text NOT NULL CHECK (status IN ('delivered', 'pending', 'expired')),
  created_at timestamptz DEFAULT now()
);

-- Create sst_medical_exams table
CREATE TABLE IF NOT EXISTS sst_medical_exams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  exam_type text NOT NULL,
  exam_date date NOT NULL,
  next_exam_date date,
  status text NOT NULL CHECK (status IN ('valid', 'expired', 'scheduled')),
  result text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- Create sst_incidents table
CREATE TABLE IF NOT EXISTS sst_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  incident_date date NOT NULL,
  incident_type text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('minor', 'moderate', 'severe', 'fatal')),
  description text DEFAULT '',
  department text NOT NULL,
  days_lost integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Create attendance_records table
CREATE TABLE IF NOT EXISTS attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  date date NOT NULL,
  status text NOT NULL CHECK (status IN ('present', 'absent', 'late', 'justified')),
  hours_worked decimal(5,2) DEFAULT 0,
  delay_minutes integer DEFAULT 0,
  justification text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  UNIQUE(employee_id, date)
);

-- Create sheets_sync_config table
CREATE TABLE IF NOT EXISTS sheets_sync_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sheet_url text NOT NULL,
  sheet_name text NOT NULL,
  data_type text NOT NULL,
  last_sync timestamptz,
  sync_enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_employee_scores_employee ON employee_scores(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_scores_period ON employee_scores(period);
CREATE INDEX IF NOT EXISTS idx_employee_rankings_period ON employee_rankings(period);
CREATE INDEX IF NOT EXISTS idx_attendance_records_employee ON attendance_records(employee_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_date ON attendance_records(date);
CREATE INDEX IF NOT EXISTS idx_sst_trainings_employee ON sst_trainings(employee_id);
CREATE INDEX IF NOT EXISTS idx_sst_incidents_date ON sst_incidents(incident_date);

-- Enable Row Level Security
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluation_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_rankings ENABLE ROW LEVEL SECURITY;
ALTER TABLE sst_trainings ENABLE ROW LEVEL SECURITY;
ALTER TABLE sst_ppe ENABLE ROW LEVEL SECURITY;
ALTER TABLE sst_medical_exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE sst_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE sheets_sync_config ENABLE ROW LEVEL SECURITY;

-- RLS Policies for anon users (allowing full access for demo purposes)
CREATE POLICY "Allow all for anon on employees"
  ON employees FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all for anon on evaluation_criteria"
  ON evaluation_criteria FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all for anon on employee_scores"
  ON employee_scores FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all for anon on employee_rankings"
  ON employee_rankings FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all for anon on sst_trainings"
  ON sst_trainings FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all for anon on sst_ppe"
  ON sst_ppe FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all for anon on sst_medical_exams"
  ON sst_medical_exams FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all for anon on sst_incidents"
  ON sst_incidents FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all for anon on attendance_records"
  ON attendance_records FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all for anon on sheets_sync_config"
  ON sheets_sync_config FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

-- Insert default evaluation criteria
INSERT INTO evaluation_criteria (name, description, data_type, weight, direction, source, display_order) VALUES
('Assiduidade', 'Número de faltas no período', 'numeric', 30.00, 'lower_better', 'calculated', 1),
('Pontualidade', 'Número de atrasos no período', 'numeric', 10.00, 'lower_better', 'calculated', 2),
('Horas Trabalhadas', 'Cumprimento da carga horária', 'numeric', 15.00, 'higher_better', 'calculated', 3),
('Atestados Válidos', 'Entrega correta de documentação', 'binary', 10.00, 'higher_better', 'manual', 4),
('Treinamentos', 'Participação em cursos e treinamentos', 'percentage', 20.00, 'higher_better', 'calculated', 5),
('Colaboração', 'Avaliações de colegas e supervisores', 'score', 15.00, 'higher_better', 'manual', 6)
ON CONFLICT DO NOTHING;