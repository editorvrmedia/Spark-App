-- =============================================================================
-- SPARK APP — Database Linter Security Hardening Patch
-- Migration File: database/fix_linter_warnings.sql
-- Enforces strict search paths, limits execution rights of security definer
-- functions, and tightens RLS & storage configurations.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. HARDENING: Establish search_path for SECURITY DEFINER functions (LINTER FIX)
-- -----------------------------------------------------------------------------
ALTER FUNCTION moderation.set_reviewed_at() SET search_path = moderation, public, pg_temp;
ALTER FUNCTION public.notify_on_like() SET search_path = public, pg_temp;
ALTER FUNCTION public.notify_on_comment() SET search_path = public, pg_temp;
ALTER FUNCTION public.notify_on_follow() SET search_path = public, pg_temp;
ALTER FUNCTION public.notify_on_post_status_change() SET search_path = public, pg_temp;
ALTER FUNCTION public.get_conversations(UUID) SET search_path = public, pg_temp;
ALTER FUNCTION public.handle_new_user_signup() SET search_path = public, pg_temp;
ALTER FUNCTION public.set_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION public.set_published_at_on_approve() SET search_path = public, pg_temp;
ALTER FUNCTION public.enqueue_post_for_moderation() SET search_path = public, pg_temp;
ALTER FUNCTION public.current_profile() SET search_path = public, pg_temp;
ALTER FUNCTION public.sync_admin_whitelist_role() SET search_path = public, pg_temp;
ALTER FUNCTION public.sync_profile_role_on_email_change() SET search_path = public, pg_temp;
ALTER FUNCTION public.is_admin() SET search_path = public, pg_temp;
ALTER FUNCTION public.toggle_follow(UUID, UUID) SET search_path = public, pg_temp;
ALTER FUNCTION public.check_profile_update_privileges() SET search_path = public, pg_temp;
ALTER FUNCTION public.check_post_update_privileges() SET search_path = public, pg_temp;

-- -----------------------------------------------------------------------------
-- 2. HARDENING: Redefine get_follower_count/get_following_count to SECURITY INVOKER
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_follower_count(profile_id UUID)
RETURNS BIGINT LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, pg_temp AS $$
    SELECT COUNT(*) FROM public.follows
    WHERE following_id = profile_id;
$$;

CREATE OR REPLACE FUNCTION public.get_following_count(profile_id UUID)
RETURNS BIGINT LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, pg_temp AS $$
    SELECT COUNT(*) FROM public.follows
    WHERE follower_id = profile_id;
$$;

-- -----------------------------------------------------------------------------
-- 3. HARDENING: Restrict Function Execution Privileges (LINTER FIX)
-- -----------------------------------------------------------------------------
-- By default, functions can be executed by PUBLIC (anon/authenticated roles).
-- We revoke PUBLIC execute rights on security definers and grant where needed.

-- A. Revoke all execution rights from PUBLIC by default
REVOKE EXECUTE ON FUNCTION moderation.set_reviewed_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_like() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_comment() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_follow() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_post_status_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_signup() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_published_at_on_approve() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enqueue_post_for_moderation() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_profile_update_privileges() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_post_update_privileges() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_admin_whitelist_role() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_profile_role_on_email_change() FROM PUBLIC, anon, authenticated;

-- Grant EXECUTE to supabase_auth_admin for auth triggers
GRANT EXECUTE ON FUNCTION public.handle_new_user_signup() TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.sync_profile_role_on_email_change() TO supabase_auth_admin;

-- Grant EXECUTE to authenticated for triggers on tables they can modify
GRANT EXECUTE ON FUNCTION public.set_updated_at() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.notify_on_like() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.notify_on_comment() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.notify_on_follow() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.notify_on_post_status_change() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.enqueue_post_for_moderation() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.check_profile_update_privileges() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.check_post_update_privileges() TO authenticated, service_role;

-- Grant EXECUTE to service_role for moderation and admin triggers
GRANT EXECUTE ON FUNCTION moderation.set_reviewed_at() TO service_role;
GRANT EXECUTE ON FUNCTION public.set_published_at_on_approve() TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_admin_whitelist_role() TO service_role;

-- B. Limit functions called directly by clients to authenticated users ONLY
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_conversations(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_conversations(UUID) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.current_profile() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.current_profile() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.toggle_follow(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_follow(UUID, UUID) TO authenticated;

-- Allow anon and authenticated to execute get_follower_count and get_following_count (now invokers)
GRANT EXECUTE ON FUNCTION public.get_follower_count(UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_following_count(UUID) TO authenticated, anon;

-- -----------------------------------------------------------------------------
-- 4. FIX: notifications table RLS insert security linter warning
-- -----------------------------------------------------------------------------
-- Drop notifications_insert_service policy. Security Definer triggers run as owner
-- and bypass RLS automatically, so clients don't need direct insert permissions.
DROP POLICY IF EXISTS notifications_insert_service ON public.notifications;

-- -----------------------------------------------------------------------------
-- 5. FIX: storage select listing security linter warning
-- -----------------------------------------------------------------------------
-- Restrict broad select on post-images bucket objects to authenticated users or owner.
DROP POLICY IF EXISTS "Allow Public Select on post-images" ON storage.objects;
CREATE POLICY "Allow Public Select on post-images" ON storage.objects
    FOR SELECT
    USING (
        bucket_id = 'post-images'
        AND (owner = auth.uid() OR auth.role() = 'authenticated')
    );
