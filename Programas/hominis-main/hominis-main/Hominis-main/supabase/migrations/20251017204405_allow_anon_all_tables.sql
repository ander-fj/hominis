/*
  # Allow Anonymous Access to All MRS Tables

  ## Changes
  This migration allows anonymous (unauthenticated) users to perform operations on all MRS system tables.
  This is useful for development/testing or when authentication is not yet implemented.
  
  ## Security Notes
  - These policies allow full access without authentication
  - In production, you should implement proper authentication
  - Remove or restrict these policies when authentication is ready
  
  ## Tables Updated
  - evaluation_criteria
  - employee_scores
  - employee_rankings
  - sst_trainings
  - sst_ppe
  - sst_medical_exams
  - sst_incidents
*/

-- evaluation_criteria
DROP POLICY IF EXISTS "Allow all operations for authenticated users on evaluation_crit" ON evaluation_criteria;
CREATE POLICY "Allow all operations for all users on evaluation_criteria"
  ON evaluation_criteria
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- employee_scores
DROP POLICY IF EXISTS "Allow all operations for authenticated users on employee_scores" ON employee_scores;
CREATE POLICY "Allow all operations for all users on employee_scores"
  ON employee_scores
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- employee_rankings
DROP POLICY IF EXISTS "Allow all operations for authenticated users on employee_rankin" ON employee_rankings;
CREATE POLICY "Allow all operations for all users on employee_rankings"
  ON employee_rankings
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- sst_trainings
DROP POLICY IF EXISTS "Allow all operations for authenticated users on sst_trainings" ON sst_trainings;
CREATE POLICY "Allow all operations for all users on sst_trainings"
  ON sst_trainings
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- sst_ppe
DROP POLICY IF EXISTS "Allow all operations for authenticated users on sst_ppe" ON sst_ppe;
CREATE POLICY "Allow all operations for all users on sst_ppe"
  ON sst_ppe
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- sst_medical_exams
DROP POLICY IF EXISTS "Allow all operations for authenticated users on sst_medical_exa" ON sst_medical_exams;
CREATE POLICY "Allow all operations for all users on sst_medical_exams"
  ON sst_medical_exams
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- sst_incidents
DROP POLICY IF EXISTS "Allow all operations for authenticated users on sst_incidents" ON sst_incidents;
CREATE POLICY "Allow all operations for all users on sst_incidents"
  ON sst_incidents
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);
