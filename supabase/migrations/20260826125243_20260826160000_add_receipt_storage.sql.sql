/*
# Add receipt photo storage for activity records

1. Modified Tables
- `activity_records` gains a `receipt_path` text column storing the Supabase Storage object path for an uploaded receipt photo (nota fiscal / cupom fiscal). Nullable: records without a receipt have null.

2. Storage
- Creates a public storage bucket `receipts` for receipt photos.
- Policies allow authenticated users to upload, read, update, and delete objects in the `receipts` bucket (shared company workspace, matching the existing data access model).

3. Security
- Storage policies are scoped to authenticated users.
- The bucket is public for reads so receipt images can be displayed in the app via the public URL.

4. Important Notes
- Existing activity_records rows are not affected; the new column defaults to null.
- Only records that have a monetary value (amount > 0) will use the receipt photo feature in the UI.
*/

ALTER TABLE activity_records
  ADD COLUMN IF NOT EXISTS receipt_path text;

INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "receipts_select_all" ON storage.objects;
CREATE POLICY "receipts_select_all" ON storage.objects FOR SELECT
  TO authenticated USING (bucket_id = 'receipts');

DROP POLICY IF EXISTS "receipts_insert_all" ON storage.objects;
CREATE POLICY "receipts_insert_all" ON storage.objects FOR INSERT
  TO authenticated WITH CHECK (bucket_id = 'receipts');

DROP POLICY IF EXISTS "receipts_update_all" ON storage.objects;
CREATE POLICY "receipts_update_all" ON storage.objects FOR UPDATE
  TO authenticated USING (bucket_id = 'receipts') WITH CHECK (bucket_id = 'receipts');

DROP POLICY IF EXISTS "receipts_delete_all" ON storage.objects;
CREATE POLICY "receipts_delete_all" ON storage.objects FOR DELETE
  TO authenticated USING (bucket_id = 'receipts');
