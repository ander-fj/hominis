/*
  # Criar tabela de metas SST

  1. Nova Tabela
    - `sst_goals`
      - `id` (uuid, primary key)
      - `goal_type` (text) - tipo de meta (conformidade, incidentes, treinamentos, epis)
      - `goal_value` (numeric) - valor da meta
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Segurança
    - Habilitar RLS
    - Adicionar políticas para acesso anônimo (leitura e escrita)
*/

CREATE TABLE IF NOT EXISTS sst_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_type text NOT NULL UNIQUE,
  goal_value numeric NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE sst_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir leitura anônima"
  ON sst_goals
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Permitir inserção anônima"
  ON sst_goals
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Permitir atualização anônima"
  ON sst_goals
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Permitir exclusão anônima"
  ON sst_goals
  FOR DELETE
  TO anon
  USING (true);

-- Inserir metas padrão
INSERT INTO sst_goals (goal_type, goal_value) VALUES
  ('conformidade', 95),
  ('incidentes', 5),
  ('treinamentos', 90),
  ('epis', 98)
ON CONFLICT (goal_type) DO NOTHING;