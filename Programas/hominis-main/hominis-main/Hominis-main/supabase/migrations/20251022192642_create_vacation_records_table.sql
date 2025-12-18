/*
  # Criar tabela de registros de férias

  1. Nova Tabela
    - `vacation_records`
      - `id` (uuid, PK)
      - `employee_id` (uuid, FK para employees)
      - `period_start` (date) - Início do período de férias
      - `period_end` (date) - Fim do período de férias
      - `days_taken` (integer) - Dias de férias usufruídos
      - `status` (text) - Status: 'Planejado', 'Aprovado', 'Concluído', 'Cancelado'
      - `notes` (text, opcional) - Observações
      - `created_at` (timestamptz)

  2. Segurança
    - Habilitar RLS
    - Políticas para autenticados lerem e modificarem dados
*/

-- Criar tabela de férias
CREATE TABLE IF NOT EXISTS vacation_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  days_taken integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'Planejado',
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Adicionar constraint para status válidos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'vacation_records_status_check'
  ) THEN
    ALTER TABLE vacation_records 
    ADD CONSTRAINT vacation_records_status_check 
    CHECK (status IN ('Planejado', 'Aprovado', 'Concluído', 'Cancelado'));
  END IF;
END $$;

-- Habilitar RLS
ALTER TABLE vacation_records ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Autenticados podem ler férias"
  ON vacation_records FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Autenticados podem inserir férias"
  ON vacation_records FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Autenticados podem atualizar férias"
  ON vacation_records FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Autenticados podem deletar férias"
  ON vacation_records FOR DELETE
  TO authenticated
  USING (true);

-- Políticas para anônimos (temporário para desenvolvimento)
CREATE POLICY "Anônimos podem ler férias"
  ON vacation_records FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anônimos podem inserir férias"
  ON vacation_records FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anônimos podem atualizar férias"
  ON vacation_records FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anônimos podem deletar férias"
  ON vacation_records FOR DELETE
  TO anon
  USING (true);