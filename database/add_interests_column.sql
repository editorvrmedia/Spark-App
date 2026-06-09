-- =============================================================================
-- SPARK APP — ADD INTERESTS COLUMN TO PROFILES
-- Run this in your Supabase SQL Editor to add the interests array column.
-- =============================================================================

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS interests TEXT[] DEFAULT '{}';

-- Optional: Update description comment
COMMENT ON COLUMN public.profiles.interests IS 'List of student interest tags (sports, cultural, etc.) stored separately from the bio.';
