/*
# Create activity records for field actions

1. New Tables
- `activity_records` stores actions registered from the technician's activity screen.
- `id` uniquely identifies each record.
- `activity_id` links the record to an existing activity.
- `type` identifies the action: displacement, evidence, fuel, meal, material, or expense.
- `description` stores the technician's notes or details.
- `amount` stores the optional monetary value for expense-related records.
- `created_by` stores the authenticated user who created the record.
- `created_at` stores when the record was created.

2. Security
- Row level security is enabled.
- Authenticated users can read and manage records in the shared company workspace, matching the existing activities access model.

3. Important Notes
- Existing activity data is not modified.
- Records are appendable and remain available after refreshing the app.
*/

CREATE TABLE IF NOT EXISTS activity_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id uuid NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('displacement', 'evidence', 'fuel', 'meal', 'material', 'expense')),
  description text NOT NULL,
  amount numeric(14, 2) NOT NULL DEFAULT 0,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE activity_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "activity_records_select_all" ON activity_records;
CREATE POLICY "activity_records_select_all" ON activity_records FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "activity_records_insert_all" ON activity_records;
CREATE POLICY "activity_records_insert_all" ON activity_records FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "activity_records_update_all" ON activity_records;
CREATE POLICY "activity_records_update_all" ON activity_records FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "activity_records_delete_all" ON activity_records;
CREATE POLICY "activity_records_delete_all" ON activity_records FOR DELETE
  TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_activity_records_activity ON activity_records(activity_id);
CREATE INDEX IF NOT EXISTS idx_activity_records_type ON activity_records(type);
