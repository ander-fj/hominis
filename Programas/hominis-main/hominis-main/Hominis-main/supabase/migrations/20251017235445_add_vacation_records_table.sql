/*
  # Adiciona tabela de férias dos colaboradores

  1. Nova Tabela
    - `vacation_records`
      - `id` (uuid, primary key)
      - `employee_id` (uuid, foreign key)
      - `start_date` (date) - Data de início das férias
      - `end_date` (date) - Data de término das férias
      - `days_count` (integer) - Número de dias de férias
      - `status` (text) - Status: scheduled, approved, ongoing, completed
      - `year_reference` (integer) - Ano de referência das férias
      - `notes` (text) - Observações
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Segurança
    - Habilita RLS na tabela `vacation_records`
    - Adiciona políticas para acesso anônimo (desenvolvimento)
*/

CREATE TABLE IF NOT EXISTS vacation_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  days_count integer NOT NULL DEFAULT 0,
  status text NOT NULL CHECK (status IN ('scheduled', 'approved', 'ongoing', 'completed', 'cancelled')),
  year_reference integer NOT NULL,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_vacation_records_employee ON vacation_records(employee_id);
CREATE INDEX IF NOT EXISTS idx_vacation_records_dates ON vacation_records(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_vacation_records_status ON vacation_records(status);

ALTER TABLE vacation_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon to read vacation_records"
  ON vacation_records FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anon to insert vacation_records"
  ON vacation_records FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anon to update vacation_records"
  ON vacation_records FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon to delete vacation_records"
  ON vacation_records FOR DELETE
  TO anon
  USING (true);
