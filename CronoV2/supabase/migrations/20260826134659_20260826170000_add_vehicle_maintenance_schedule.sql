/*
# Add vehicle maintenance schedule fields

## Overview
Adds the next planned odometer readings for oil and filter changes to the existing vehicles table. These values are optional, so existing vehicle records remain valid and unchanged.

## Modified Tables
- `vehicles`
  - `next_oil_change_odometer` (integer, nullable): odometer reading planned for the next oil change, in kilometers.
  - `next_filter_change_odometer` (integer, nullable): odometer reading planned for the next filter change, in kilometers.

## Security
- No new tables are created.
- Existing RLS and vehicle policies remain in place.
- The new fields inherit the existing vehicle table access rules.

## Important Notes
1. Existing records keep a null value until a maintenance schedule is entered.
2. No existing vehicle data is removed or changed.
3. The application displays and saves both values in kilometers.
*/

ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS next_oil_change_odometer integer,
  ADD COLUMN IF NOT EXISTS next_filter_change_odometer integer;