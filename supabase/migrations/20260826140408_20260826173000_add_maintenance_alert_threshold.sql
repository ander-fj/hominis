/*
# Persist maintenance alert threshold

## Overview
Stores each signed-in user's selected vehicle maintenance alert distance so the choice remains active when navigating between pages and after reopening the application.

## Modified Tables
- `profiles`
  - `maintenance_alert_threshold` (integer, not null, default 1000): distance in kilometers before the planned oil or filter change that should trigger an alert.

## Security
- No new tables are created.
- Existing profile row-level security remains in place.
- The existing profile policies allow users to read shared profile data and update only their own profile row.

## Important Notes
1. Existing users receive a default threshold of 1,000 km.
2. The value is restricted to the application choices in the interface; the database default preserves compatibility with existing profiles.
3. No existing user or vehicle data is removed or changed.
*/

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS maintenance_alert_threshold integer NOT NULL DEFAULT 1000;