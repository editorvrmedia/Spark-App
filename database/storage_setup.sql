-- =============================================================================
-- SPARK APP — Storage Setup & Image Upload Integration
-- Migration File: Creates storage bucket and updates posts schema
-- =============================================================================

-- 1. Add image_url column to public.posts table
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Comment for clarity
COMMENT ON COLUMN public.posts.image_url IS 'Public direct URL of the main attached banner image, uploaded to Supabase storage.';

-- 2. Define the public 'post-images' storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('post-images', 'post-images', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Storage Policies on storage.objects
-- Allow public SELECT/Read access to objects inside the 'post-images' bucket
CREATE POLICY "Allow Public Select on post-images" ON storage.objects
    FOR SELECT
    USING (bucket_id = 'post-images');

-- Allow authenticated users to INSERT/Upload objects into 'post-images' bucket
CREATE POLICY "Allow Authenticated Insert on post-images" ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'post-images');

-- Allow authenticated users to UPDATE/DELETE their own uploaded objects
CREATE POLICY "Allow Authenticated Owner Modification on post-images" ON storage.objects
    FOR ALL
    TO authenticated
    USING (bucket_id = 'post-images' AND auth.uid() = owner);
