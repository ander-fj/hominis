/*
  # Adicionar campos employee_name e photo_url à tabela employee_rankings

  ## Alterações
  - Adiciona coluna `employee_name` (text) para desnormalizar o nome do funcionário
  - Adiciona coluna `photo_url` (text, nullable) para desnormalizar a foto do funcionário
  - Esses campos facilitam queries e reduzem JOINs no ranking

  ## Nota
  - Os dados serão preenchidos quando os rankings forem recalculados
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employee_rankings' AND column_name = 'employee_name'
  ) THEN
    ALTER TABLE employee_rankings ADD COLUMN employee_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employee_rankings' AND column_name = 'photo_url'
  ) THEN
    ALTER TABLE employee_rankings ADD COLUMN photo_url text;
  END IF;
END $$;

-- Atualizar registros existentes com dados dos employees
UPDATE employee_rankings er
SET 
  employee_name = e.name,
  photo_url = e.photo_url
FROM employees e
WHERE er.employee_id = e.id
  AND er.employee_name IS NULL;