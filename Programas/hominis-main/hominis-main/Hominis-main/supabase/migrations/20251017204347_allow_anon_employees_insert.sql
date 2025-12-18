/*
  # Allow Anonymous Access to Employees Table

  ## Changes
  This migration allows anonymous (unauthenticated) users to perform operations on the employees table.
  This is useful for development/testing or when authentication is not yet implemented.
  
  ## Security Notes
  - This policy allows full access without authentication
  - In production, you should implement proper authentication
  - Remove or restrict this policy when authentication is ready
  
  ## Policies
  - DROP existing restrictive policy
  - CREATE new policy allowing anonymous access for all operations (SELECT, INSERT, UPDATE, DELETE)
*/

-- Drop existing policy
DROP POLICY IF EXISTS "Allow all operations for authenticated users on employees" ON employees;

-- Create policy allowing anonymous access
CREATE POLICY "Allow all operations for all users on employees"
  ON employees
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);
