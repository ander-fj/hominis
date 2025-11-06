/*
  # Change severity field to Portuguese

  1. Changes
    - Drop existing check constraint on severity field
    - Add new check constraint with Portuguese values: 'leve', 'moderado', 'grave', 'fatal'
  
  2. Notes
    - This allows users to input severity values in Portuguese
    - Maintains data validation while supporting localization
*/

-- Drop the existing English severity constraint
ALTER TABLE sst_incidents 
DROP CONSTRAINT IF EXISTS sst_incidents_severity_check;

-- Add new Portuguese severity constraint
ALTER TABLE sst_incidents 
ADD CONSTRAINT sst_incidents_severity_check 
CHECK (severity = ANY (ARRAY['leve'::text, 'moderado'::text, 'grave'::text, 'fatal'::text]));
