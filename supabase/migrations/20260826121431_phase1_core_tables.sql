/*
# Phase 1 - Core Tables: Users, Clients, Projects, Work Orders, Activities, Teams, Vehicles

## Overview
Creates the foundational schema for the field activity control system.
Multi-user, multi-role application where all authenticated users share company data.

## New Tables
1. `profiles` - Extends auth.users with name, role, phone, active status
2. `clients` - Customers/clients for projects
3. `teams` - Work teams/crews
4. `team_members` - Junction table linking users to teams
5. `vehicles` - Company vehicles
6. `projects` (obras) - Construction/field projects with location, budget, status
7. `work_orders` (OS) - Work orders linked to projects
8. `activities` - Individual activities linked to work orders

## Security
- RLS enabled on all tables
- All authenticated users can read all data (shared company system)
- Profiles: users can read all, update only their own
*/

-- ============ PROFILES ============
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'tecnico' CHECK (role IN ('admin', 'gestor', 'tecnico', 'financeiro')),
  phone text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_all" ON profiles;
CREATE POLICY "profiles_select_all" ON profiles FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ============ CLIENTS ============
CREATE TABLE IF NOT EXISTS clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  document text,
  email text,
  phone text,
  address text,
  city text,
  state text,
  zip_code text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clients_select_all" ON clients;
CREATE POLICY "clients_select_all" ON clients FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "clients_insert_all" ON clients;
CREATE POLICY "clients_insert_all" ON clients FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "clients_update_all" ON clients;
CREATE POLICY "clients_update_all" ON clients FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "clients_delete_all" ON clients;
CREATE POLICY "clients_delete_all" ON clients FOR DELETE
  TO authenticated USING (true);

-- ============ TEAMS ============
CREATE TABLE IF NOT EXISTS teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  leader_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "teams_select_all" ON teams;
CREATE POLICY "teams_select_all" ON teams FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "teams_insert_all" ON teams;
CREATE POLICY "teams_insert_all" ON teams FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "teams_update_all" ON teams;
CREATE POLICY "teams_update_all" ON teams FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "teams_delete_all" ON teams;
CREATE POLICY "teams_delete_all" ON teams FOR DELETE
  TO authenticated USING (true);

-- ============ TEAM MEMBERS ============
CREATE TABLE IF NOT EXISTS team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(team_id, user_id)
);

ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "team_members_select_all" ON team_members;
CREATE POLICY "team_members_select_all" ON team_members FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "team_members_insert_all" ON team_members;
CREATE POLICY "team_members_insert_all" ON team_members FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "team_members_update_all" ON team_members;
CREATE POLICY "team_members_update_all" ON team_members FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "team_members_delete_all" ON team_members;
CREATE POLICY "team_members_delete_all" ON team_members FOR DELETE
  TO authenticated USING (true);

-- ============ VEHICLES ============
CREATE TABLE IF NOT EXISTS vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plate text NOT NULL UNIQUE,
  model text NOT NULL,
  brand text,
  year integer,
  color text,
  fuel_type text DEFAULT 'flex',
  odometer integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vehicles_select_all" ON vehicles;
CREATE POLICY "vehicles_select_all" ON vehicles FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "vehicles_insert_all" ON vehicles;
CREATE POLICY "vehicles_insert_all" ON vehicles FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "vehicles_update_all" ON vehicles;
CREATE POLICY "vehicles_update_all" ON vehicles FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "vehicles_delete_all" ON vehicles;
CREATE POLICY "vehicles_delete_all" ON vehicles FOR DELETE
  TO authenticated USING (true);

-- ============ PROJECTS (OBRAS) ============
CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  name text NOT NULL,
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  contract text,
  cost_center text,
  manager_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  address text,
  city text,
  state text,
  latitude numeric(10, 7),
  longitude numeric(10, 7),
  start_date date,
  planned_end_date date,
  actual_end_date date,
  budget numeric(14, 2) DEFAULT 0,
  status text NOT NULL DEFAULT 'planejada' CHECK (status IN ('planejada', 'em_andamento', 'pausada', 'concluida', 'cancelada')),
  description text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "projects_select_all" ON projects;
CREATE POLICY "projects_select_all" ON projects FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "projects_insert_all" ON projects;
CREATE POLICY "projects_insert_all" ON projects FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "projects_update_all" ON projects;
CREATE POLICY "projects_update_all" ON projects FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "projects_delete_all" ON projects;
CREATE POLICY "projects_delete_all" ON projects FOR DELETE
  TO authenticated USING (true);

-- ============ WORK ORDERS (OS) ============
CREATE TABLE IF NOT EXISTS work_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number text NOT NULL,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  priority text NOT NULL DEFAULT 'media' CHECK (priority IN ('baixa', 'media', 'alta', 'critica')),
  responsible_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  team_id uuid REFERENCES teams(id) ON DELETE SET NULL,
  planned_date date,
  planned_time time,
  location text,
  status text NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta', 'agendada', 'em_deslocamento', 'em_execucao', 'aguardando', 'concluida', 'cancelada')),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE work_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "work_orders_select_all" ON work_orders;
CREATE POLICY "work_orders_select_all" ON work_orders FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "work_orders_insert_all" ON work_orders;
CREATE POLICY "work_orders_insert_all" ON work_orders FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "work_orders_update_all" ON work_orders;
CREATE POLICY "work_orders_update_all" ON work_orders FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "work_orders_delete_all" ON work_orders;
CREATE POLICY "work_orders_delete_all" ON work_orders FOR DELETE
  TO authenticated USING (true);

-- ============ ACTIVITIES ============
CREATE TABLE IF NOT EXISTS activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number text NOT NULL,
  work_order_id uuid NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  responsible_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  team_id uuid REFERENCES teams(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  location text,
  latitude numeric(10, 7),
  longitude numeric(10, 7),
  status text NOT NULL DEFAULT 'planejada' CHECK (status IN ('planejada', 'em_andamento', 'concluida', 'cancelada')),
  planned_date date,
  planned_time time,
  started_at timestamptz,
  finished_at timestamptz,
  start_latitude numeric(10, 7),
  start_longitude numeric(10, 7),
  finish_latitude numeric(10, 7),
  finish_longitude numeric(10, 7),
  service_description text,
  observations text,
  problems text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "activities_select_all" ON activities;
CREATE POLICY "activities_select_all" ON activities FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "activities_insert_all" ON activities;
CREATE POLICY "activities_insert_all" ON activities FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "activities_update_all" ON activities;
CREATE POLICY "activities_update_all" ON activities FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "activities_delete_all" ON activities;
CREATE POLICY "activities_delete_all" ON activities FOR DELETE
  TO authenticated USING (true);

-- ============ INDEXES ============
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_client ON projects(client_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_project ON work_orders(project_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_status ON work_orders(status);
CREATE INDEX IF NOT EXISTS idx_activities_project ON activities(project_id);
CREATE INDEX IF NOT EXISTS idx_activities_work_order ON activities(work_order_id);
CREATE INDEX IF NOT EXISTS idx_activities_status ON activities(status);
CREATE INDEX IF NOT EXISTS idx_activities_responsible ON activities(responsible_id);
CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(user_id);

-- ============ AUTO-UPDATE updated_at TRIGGER ============
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_profiles_updated ON profiles;
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_clients_updated ON clients;
CREATE TRIGGER trg_clients_updated BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_teams_updated ON teams;
CREATE TRIGGER trg_teams_updated BEFORE UPDATE ON teams
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_vehicles_updated ON vehicles;
CREATE TRIGGER trg_vehicles_updated BEFORE UPDATE ON vehicles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_projects_updated ON projects;
CREATE TRIGGER trg_projects_updated BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_work_orders_updated ON work_orders;
CREATE TRIGGER trg_work_orders_updated BEFORE UPDATE ON work_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_activities_updated ON activities;
CREATE TRIGGER trg_activities_updated BEFORE UPDATE ON activities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============ AUTO-CREATE PROFILE ON SIGNUP ============
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'tecnico')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
