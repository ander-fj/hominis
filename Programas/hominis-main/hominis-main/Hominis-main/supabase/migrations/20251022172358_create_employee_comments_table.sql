/*
  # Criar tabela de comentários de funcionários

  ## Nova Tabela
  - `employee_comments` - Comentários sobre funcionários
    - `id` (uuid, primary key)
    - `employee_id` (uuid, foreign key)
    - `comment` (text)
    - `created_at` (timestamptz)
    - `created_by` (text)

  ## Segurança
  - RLS habilitado
  - Políticas para acesso anônimo
*/

CREATE TABLE IF NOT EXISTS employee_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  comment text NOT NULL,
  created_by text DEFAULT 'system',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE employee_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for anon on employee_comments"
  ON employee_comments
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_employee_comments_employee ON employee_comments(employee_id);