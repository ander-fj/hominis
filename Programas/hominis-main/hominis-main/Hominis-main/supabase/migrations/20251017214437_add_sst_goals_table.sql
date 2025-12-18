/*
  # Criar Tabela de Metas SST

  1. Nova Tabela
    - `sst_goals`
      - `id` (uuid, primary key)
      - `goal_type` (text) - Tipo de meta: 'conformidade', 'incidentes', 'treinamentos', 'epis'
      - `goal_value` (numeric) - Valor da meta
      - `description` (text) - Descrição da meta
      - `is_minimum` (boolean) - Se true, meta é mínima (>=), se false, meta é máxima (<=)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
  
  2. Segurança
    - Habilitar RLS na tabela `sst_goals`
    - Permitir leitura pública (anon)
    - Permitir escrita pública (anon) para demonstração

  3. Dados Iniciais
    - Conformidade: 95% (mínima)
    - Incidentes: 5 (máxima)
    - Treinamentos: 90% (mínima)
    - EPIs: 98% (mínima)
*/

-- Criar tabela de metas SST
CREATE TABLE IF NOT EXISTS sst_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_type text NOT NULL UNIQUE,
  goal_value numeric NOT NULL,
  description text NOT NULL,
  is_minimum boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE sst_goals ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso
CREATE POLICY "Permitir leitura pública de metas"
  ON sst_goals
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Permitir inserção pública de metas"
  ON sst_goals
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Permitir atualização pública de metas"
  ON sst_goals
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

-- Inserir metas padrão
INSERT INTO sst_goals (goal_type, goal_value, description, is_minimum)
VALUES 
  ('conformidade', 95, 'Taxa de conformidade de exames médicos', true),
  ('incidentes', 5, 'Máximo de incidentes por mês', false),
  ('treinamentos', 90, 'Taxa de conclusão de treinamentos', true),
  ('epis', 98, 'EPIs em boas condições', true)
ON CONFLICT (goal_type) DO NOTHING;

-- Inserir critérios de SST na tabela de evaluation_criteria
INSERT INTO public.evaluation_criteria (name, description, data_type, weight, direction, source, active, display_order)
VALUES
  (
    'Treinamentos SST',
    'Número de treinamentos de SST concluídos e válidos.',
    'numeric', 10, 'higher_better', 'calculated', true, 6
  ),
  (
    'Exames Médicos',
    'Número de exames médicos ocupacionais válidos.',
    'numeric', 10, 'higher_better', 'calculated', true, 7
  )
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  weight = EXCLUDED.weight,
  direction = EXCLUDED.direction;