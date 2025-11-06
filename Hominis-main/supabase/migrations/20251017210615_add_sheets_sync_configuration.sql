/*
  # Configuração Avançada de Sincronização Google Sheets

  ## Descrição
  Adiciona tabela para configurar quais páginas do sistema serão sincronizadas
  com suas respectivas abas do Google Sheets, com opção de acumular dados.

  ## Novas Tabelas
  
  ### `sheets_sync_pages`
  - `id` (uuid, primary key)
  - `page_name` (text) - Nome da página/módulo (ex: "colaboradores", "avaliacoes")
  - `sheet_name` (text) - Nome da aba no Google Sheets
  - `table_name` (text) - Nome da tabela no banco de dados
  - `is_enabled` (boolean) - Se esta página está habilitada para sync
  - `accumulate_data` (boolean) - Se deve acumular dados ou substituir
  - `last_sync_at` (timestamptz) - Data da última sincronização
  - `sync_count` (integer) - Contador de sincronizações realizadas
  - `description` (text) - Descrição da página
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ## Segurança
  - RLS habilitado
  - Políticas permitem acesso anônimo (desenvolvimento)

  ## Dados Iniciais
  Páginas pré-configuradas:
  - Colaboradores
  - Avaliações de Desempenho
  - Treinamentos SST
  - Equipamentos de Proteção (EPIs)
  - Exames Médicos
  - Incidentes de Segurança
*/

-- Criar tabela de configuração de páginas de sincronização
CREATE TABLE IF NOT EXISTS sheets_sync_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_name text NOT NULL UNIQUE,
  sheet_name text NOT NULL,
  table_name text NOT NULL,
  is_enabled boolean DEFAULT true,
  accumulate_data boolean DEFAULT false,
  last_sync_at timestamptz,
  sync_count integer DEFAULT 0,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE sheets_sync_pages ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso (desenvolvimento - permitir anônimo)
CREATE POLICY "Allow all operations for all users on sheets_sync_pages"
  ON sheets_sync_pages
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Inserir configurações padrão das páginas
INSERT INTO sheets_sync_pages (page_name, sheet_name, table_name, is_enabled, accumulate_data, description)
VALUES 
  (
    'colaboradores',
    'Colaboradores',
    'employees',
    true,
    false,
    'Cadastro de colaboradores com dados pessoais e profissionais'
  ),
  (
    'avaliacoes',
    'Avaliacoes',
    'employee_scores',
    true,
    true,
    'Avaliações mensais de desempenho dos colaboradores'
  ),
  (
    'treinamentos',
    'Treinamentos',
    'sst_trainings',
    true,
    true,
    'Registro de treinamentos de Segurança e Saúde no Trabalho'
  ),
  (
    'epis',
    'EPIs',
    'sst_ppe',
    true,
    true,
    'Controle de entrega e uso de Equipamentos de Proteção Individual'
  ),
  (
    'exames',
    'Exames',
    'sst_medical_exams',
    true,
    true,
    'Registro de exames médicos ocupacionais'
  ),
  (
    'incidentes',
    'Incidentes',
    'sst_incidents',
    true,
    true,
    'Registro de acidentes e quase-acidentes de trabalho'
  )
ON CONFLICT (page_name) DO NOTHING;

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_sheets_sync_pages_enabled ON sheets_sync_pages(is_enabled);
CREATE INDEX IF NOT EXISTS idx_sheets_sync_pages_page_name ON sheets_sync_pages(page_name);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_sheets_sync_pages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_sheets_sync_pages_updated_at ON sheets_sync_pages;
CREATE TRIGGER trigger_update_sheets_sync_pages_updated_at
  BEFORE UPDATE ON sheets_sync_pages
  FOR EACH ROW
  EXECUTE FUNCTION update_sheets_sync_pages_updated_at();