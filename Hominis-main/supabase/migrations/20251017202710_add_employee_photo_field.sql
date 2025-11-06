/*
  # Add Photo Field to Employees

  ## Changes
  - Add `photo_url` column to employees table to store employee profile photos
  - Column accepts text URLs (can be data URLs, external URLs, or Supabase Storage URLs)
  - Field is optional (nullable)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employees' AND column_name = 'photo_url'
  ) THEN
    ALTER TABLE employees ADD COLUMN photo_url text;
  END IF;
END $$;
