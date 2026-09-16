/*
# Restrict activity_records deletion to admins only

## Why
Previously any authenticated user could delete any activity record (policy
`activity_records_delete_all` had `USING (true)`). The product requirement is
that only admin users may delete records from an activity.

## Changes
- Drops the permissive `activity_records_delete_all` policy.
- Creates a new DELETE policy that allows deletion only when the calling user
  has the `admin` role in `profiles`.

## Security
- DELETE on `activity_records` is now restricted to authenticated users whose
  `profiles.role = 'admin'`.
- SELECT / INSERT / UPDATE policies are unchanged.
*/

DROP POLICY IF EXISTS "activity_records_delete_all" ON activity_records;

CREATE POLICY "activity_records_delete_admin_only"
ON activity_records FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);
