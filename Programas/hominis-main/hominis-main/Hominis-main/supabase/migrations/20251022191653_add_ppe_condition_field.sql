/*
  # Adicionar campo de condição aos EPIs

  1. Alterações
    - Adicionar coluna `condition` à tabela `sst_ppe`
      - Valores: 'Novo', 'Usado', 'Desgastado'
    - Permitir status mais flexíveis

  2. Notas
    - Mantém compatibilidade com dados existentes
    - Adiciona nova dimensão de tracking de EPIs
*/

-- Adicionar campo de condição
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'sst_ppe' AND column_name = 'condition'
  ) THEN
    ALTER TABLE sst_ppe ADD COLUMN condition text DEFAULT 'Novo';
  END IF;
END $$;

-- Adicionar constraint para valores válidos de condition
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'sst_ppe_condition_check'
  ) THEN
    ALTER TABLE sst_ppe 
    ADD CONSTRAINT sst_ppe_condition_check 
    CHECK (condition IN ('Novo', 'Usado', 'Desgastado'));
  END IF;
END $$;