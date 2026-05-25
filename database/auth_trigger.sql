-- =============================================================================
-- SPARK APP — Auth Trigger & Achievements Schema
-- Migration File: Adds profiles trigger & achievements database table
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Table: public.achievements
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.achievements (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id  UUID        NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
    badge_type  TEXT        NOT NULL, -- 'core_team', 'contributor', 'student_leader'
    title       TEXT        NOT NULL, -- Human-readable title
    description TEXT        NOT NULL, -- Description of the award
    earned_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_achievements_profile_id ON public.achievements (profile_id);

-- RLS policies for achievements
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;

-- Everyone can view achievements
CREATE POLICY achievements_select_public
    ON public.achievements FOR SELECT
    USING (true);

-- Only admins can insert/update achievements
CREATE POLICY achievements_write_admin
    ON public.achievements FOR ALL
    USING ((public.current_profile()).role = 'admin')
    WITH CHECK ((public.current_profile()).role = 'admin');

-- -----------------------------------------------------------------------------
-- 2. PostgreSQL trigger function for auth.users -> public.profiles
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user_signup()
RETURNS TRIGGER AS $$
DECLARE
    new_username CITEXT;
    new_display_name TEXT;
    assigned_role public.user_role;
BEGIN
    -- Extract metadata from raw_user_meta_data if present, else fallback
    new_username := COALESCE(
        (NEW.raw_user_meta_data->>'username')::CITEXT, 
        'user_' || substring(NEW.id::text from 1 for 8)
    );
    
    new_display_name := COALESCE(
        NEW.raw_user_meta_data->>'display_name',
        NEW.raw_user_meta_data->>'username',
        'Spark Student'
    );

    -- Check if the email is in the admin whitelist table
    IF EXISTS (SELECT 1 FROM public.admin_whitelist WHERE email = NEW.email) THEN
        assigned_role := 'admin';
    ELSE
        assigned_role := 'user';
    END IF;

    -- Insert into public.profiles
    INSERT INTO public.profiles (
        user_id,
        username,
        display_name,
        role,
        is_suspended
    ) VALUES (
        NEW.id,
        new_username,
        new_display_name,
        assigned_role,
        FALSE
    );

    RETURN NEW;
EXCEPTION
    WHEN unique_violation THEN
        -- Handle rare username collisions gracefully by appending short UUID segment
        INSERT INTO public.profiles (
            user_id,
            username,
            display_name,
            role,
            is_suspended
        ) VALUES (
            NEW.id,
            new_username || '_' || substring(NEW.id::text from 1 for 4),
            new_display_name,
            assigned_role,
            FALSE
        );
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger execution
DROP TRIGGER IF EXISTS trg_auth_user_created ON auth.users;
CREATE TRIGGER trg_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user_signup();

COMMENT ON FUNCTION public.handle_new_user_signup() IS 'Automatically constructs profile row inside public.profiles upon Supabase signUp validation.';

-- -----------------------------------------------------------------------------
-- 3. Triggers to keep profiles.role in sync with admin_whitelist changes
-- -----------------------------------------------------------------------------

-- Trigger function for promoting/demoting when admin_whitelist is updated
CREATE OR REPLACE FUNCTION public.sync_admin_whitelist_role()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        UPDATE public.profiles
        SET role = 'admin'
        WHERE user_id IN (
            SELECT id FROM auth.users WHERE email = NEW.email
        );
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.profiles
        SET role = 'user'
        WHERE user_id IN (
            SELECT id FROM auth.users WHERE email = OLD.email
        );
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_admin_whitelist_role ON public.admin_whitelist;
CREATE TRIGGER trg_sync_admin_whitelist_role
    AFTER INSERT OR UPDATE OR DELETE ON public.admin_whitelist
    FOR EACH ROW EXECUTE FUNCTION public.sync_admin_whitelist_role();

COMMENT ON FUNCTION public.sync_admin_whitelist_role() IS 'Automatically promotes or demotes user profiles in the profiles table when emails are added or removed from the admin whitelist.';

-- Trigger function for syncing when user emails change in auth.users
CREATE OR REPLACE FUNCTION public.sync_profile_role_on_email_change()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.email IS DISTINCT FROM OLD.email THEN
        IF EXISTS (SELECT 1 FROM public.admin_whitelist WHERE email = NEW.email) THEN
            UPDATE public.profiles
            SET role = 'admin'
            WHERE user_id = NEW.id;
        ELSE
            UPDATE public.profiles
            SET role = 'user'
            WHERE user_id = NEW.id AND role = 'admin';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_profile_role_on_email_change ON auth.users;
CREATE TRIGGER trg_sync_profile_role_on_email_change
    AFTER UPDATE OF email ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.sync_profile_role_on_email_change();

COMMENT ON FUNCTION public.sync_profile_role_on_email_change() IS 'Checks admin whitelist status and updates public.profiles role if user email changes in auth.users.';

