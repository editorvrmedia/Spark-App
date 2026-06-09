-- =============================================================================
-- SPARK APP — COMPLETE STORAGE FIX
-- Run this ENTIRE script in your Supabase SQL Editor
-- =============================================================================
-- This fixes image upload (HTTP 400) caused by two issues:
--   1. The 'post-images' bucket may not exist yet
--   2. The INSERT policy incorrectly checks auth.uid() = owner, but Supabase
--      sets the `owner` column AFTER the row is inserted — so the check always
--      fails. Fixed to only verify bucket_id and that the user is logged in.
-- =============================================================================

-- STEP 1: Create the bucket (safe to run even if it already exists)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'post-images',
  'post-images',
  true,
  5242880,  -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

-- STEP 2: Drop all old storage policies for post-images (clean slate)
DROP POLICY IF EXISTS "Allow Public Select on post-images"              ON storage.objects;
DROP POLICY IF EXISTS "Allow Authenticated Insert on post-images"       ON storage.objects;
DROP POLICY IF EXISTS "Allow Authenticated Owner Modification on post-images" ON storage.objects;

-- STEP 3: Allow anyone (even unauthenticated) to view/read images
CREATE POLICY "Allow Public Select on post-images"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'post-images');

-- STEP 4: Allow authenticated users to upload images
--   NOTE: Do NOT check `auth.uid() = owner` here — Supabase sets the owner
--         column AFTER the insert, so that check always fails (causes 400 error).
CREATE POLICY "Allow Authenticated Insert on post-images"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'post-images'
    AND auth.uid() IS NOT NULL
  );

-- STEP 5: Allow users to update or delete their own uploaded objects
CREATE POLICY "Allow Authenticated Owner Modification on post-images"
  ON storage.objects
  FOR ALL
  TO authenticated
  USING (
    bucket_id = 'post-images'
    AND (auth.uid() = owner OR auth.uid()::text = owner_id::text)
  );
