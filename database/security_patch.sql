-- =============================================================================
-- SPARK APP — Cybersecurity Hardening Patch
-- File: database/security_patch.sql
-- Enforces strict database-level security controls to prevent privilege
-- escalation, IDOR vulnerabilities, and SQL execution errors.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. FIX: IDOR vulnerability in public.toggle_follow() RPC
-- -----------------------------------------------------------------------------
-- Prevents authenticated users from spoofing follower identities and forcing
-- other users to follow/unfollow profiles.
CREATE OR REPLACE FUNCTION public.toggle_follow(follower_id_param UUID, following_id_param UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    is_following BOOLEAN;
    calling_profile_id UUID;
BEGIN
    -- Resolve the calling user's profile ID
    calling_profile_id := (public.current_profile()).id;

    -- Security Guard: caller MUST match the follower parameter
    IF follower_id_param IS DISTINCT FROM calling_profile_id THEN
        RAISE EXCEPTION 'Access Denied: You cannot toggle follows on behalf of another profile (IDOR prevention).';
    END IF;

    -- Check if follow relation exists
    SELECT EXISTS (
        SELECT 1 FROM public.follows
        WHERE follower_id = follower_id_param AND following_id = following_id_param
    ) INTO is_following;

    IF is_following THEN
        -- Unfollow
        DELETE FROM public.follows
        WHERE follower_id = follower_id_param AND following_id = following_id_param;
        RETURN FALSE;
    ELSE
        -- Follow
        INSERT INTO public.follows (follower_id, following_id)
        VALUES (follower_id_param, following_id_param);
        RETURN TRUE;
    END IF;
END;
$$;

COMMENT ON FUNCTION public.toggle_follow(UUID, UUID) IS 'Atomically toggles a follow relationship. Enforces caller identity checks to prevent IDOR spoofing.';


-- -----------------------------------------------------------------------------
-- 2. FIX: Broken RLS query syntax and status escalation in public.posts
-- -----------------------------------------------------------------------------
-- PostgreSQL RLS policies do NOT support 'OLD' record references (throws runtime syntax error).
-- We move status-change enforcement to a trigger and clean up the RLS policy.

-- A. Recreate RLS policy with clean syntax (no OLD.status reference)
DROP POLICY IF EXISTS posts_update_own_content ON public.posts;
CREATE POLICY posts_update_own_content
    ON public.posts FOR UPDATE
    USING (
        author_id = (current_profile()).id
        AND status IN ('pending', 'approved')
        AND deleted_at IS NULL
    );

-- B. Create trigger function to enforce post status and lifecycle validation
CREATE OR REPLACE FUNCTION public.check_post_update_privileges()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if status is being modified
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        -- Only moderators or admins can change a post's status (e.g. approving/rejecting)
        IF NOT EXISTS (
            SELECT 1 FROM public.admin_whitelist
            WHERE email = auth.jwt()->>'email'
        ) AND (public.current_profile()).role NOT IN ('moderator', 'admin') THEN
            RAISE EXCEPTION 'Access Denied: Only moderators and administrators can modify post status.';
        END IF;
    END IF;

    -- Enforce that standard users cannot modify posts that are rejected or archived
    IF OLD.status IN ('rejected', 'archived') AND (public.current_profile()).role NOT IN ('moderator', 'admin') THEN
        RAISE EXCEPTION 'Access Denied: You cannot modify a rejected or archived post.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- C. Register the trigger
DROP TRIGGER IF EXISTS trg_check_post_update_privileges ON public.posts;
CREATE TRIGGER trg_check_post_update_privileges
    BEFORE UPDATE ON public.posts
    FOR EACH ROW EXECUTE FUNCTION public.check_post_update_privileges();

COMMENT ON FUNCTION public.check_post_update_privileges() IS 'Enforces post lifecycle rules and prevents unauthorized status escalations.';


-- -----------------------------------------------------------------------------
-- 3. FIX: Self-promotion / Privilege Escalation in public.profiles
-- -----------------------------------------------------------------------------
-- Prevents standard users from updating their own 'role' or 'is_suspended' fields.

-- A. Create trigger function to validate profile modifications
CREATE OR REPLACE FUNCTION public.check_profile_update_privileges()
RETURNS TRIGGER AS $$
BEGIN
    -- Restrict role and suspension status changes to whitelisted admins
    IF (OLD.role IS DISTINCT FROM NEW.role OR OLD.is_suspended IS DISTINCT FROM NEW.is_suspended) THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.admin_whitelist
            WHERE email = auth.jwt()->>'email'
        ) AND (public.current_profile()).role IS DISTINCT FROM 'admin' THEN
            RAISE EXCEPTION 'Access Denied: Only administrators can modify user roles or suspension status.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- B. Register the trigger
DROP TRIGGER IF EXISTS trg_check_profile_update_privileges ON public.profiles;
CREATE TRIGGER trg_check_profile_update_privileges
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.check_profile_update_privileges();

COMMENT ON FUNCTION public.check_profile_update_privileges() IS 'Secures profiles from unauthorized privilege escalations and suspension overrides.';


-- -----------------------------------------------------------------------------
-- 4. HARDENING: Owner validation in storage.objects policy
-- -----------------------------------------------------------------------------
-- Enforces that authenticated users can only insert files that list their own auth.uid() as owner.
DROP POLICY IF EXISTS "Allow Authenticated Insert on post-images" ON storage.objects;
CREATE POLICY "Allow Authenticated Insert on post-images" ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'post-images' 
        AND auth.uid()::text = owner
    );
