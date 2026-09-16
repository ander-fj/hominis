/*
# Add vehicle tracking to activity records

## Why
Displacement records need to capture which vehicle was used and its odometer
reading at the time, so the Vehicles page hodômetro stays in sync with field
activity. When a technician registers a displacement, the vehicle's odometer
in the vehicles table should be updated to the latest informed value.

## Changes
- Adds `vehicle_id` (nullable uuid, FK to vehicles) to `activity_records`.
- Adds `odometer` (nullable integer) to `activity_records` to store the km
  reading informed at the moment of the displacement.
- Both columns are nullable so existing records and non-displacement types
  are unaffected.

## Security
- No policy changes. RLS remains enabled on `activity_records`.
- The new columns inherit the existing INSERT/UPDATE policies.
*/

ALTER TABLE activity_records
  ADD COLUMN IF NOT EXISTS vehicle_id uuid REFERENCES vehicles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS odometer integer;
