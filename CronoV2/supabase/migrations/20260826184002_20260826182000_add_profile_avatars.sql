/*
# Add secure profile avatars

## Overview
Adds a private avatar image area for user profiles and stores the uploaded file path on each profile.

## New Storage
1. `avatars` bucket
- Private bucket for profile images.
- Accepts JPEG, PNG, and WebP images up to 2 MB.

## Modified Tables
1. `profiles`
- Adds `avatar_url` containing the private storage path for the user's avatar, when one exists.

## Security
- Authenticated users may view avatar objects so the signed-in application can display team avatars.
- Only authenticated administrators may upload, replace, or delete avatar objects.
- Storage object paths are scoped to the target profile id.
*/

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url text;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  false,
  2097152,
  ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 2097152,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']::text[];

DROP POLICY IF EXISTS "avatars_select_authenticated" ON storage.objects;
CREATE POLICY "avatars_select_authenticated" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars_insert_admin" ON storage.objects;
CREATE POLICY "avatars_insert_admin" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "avatars_update_admin" ON storage.objects;
CREATE POLICY "avatars_update_admin" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "avatars_delete_admin" ON storage.objects;
CREATE POLICY "avatars_delete_admin" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );