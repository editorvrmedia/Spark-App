-- =============================================================================
-- SPARK APP — FULL SCHEMA SETUP MIGRATION
-- Concatenates all database files into a single, clean execution script.
-- Run this in your Supabase SQL Editor to initialize all tables, RLS policies,
-- security patches, and trigger functions.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Extensions & Schemas
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "citext";     -- case-insensitive text (usernames)

CREATE SCHEMA IF NOT EXISTS moderation;

-- ---------------------------------------------------------------------------
-- 2. Enum Types
-- ---------------------------------------------------------------------------
DO $$ BEGIN
    CREATE TYPE public.post_status AS ENUM (
        'pending',      -- awaiting moderation review
        'approved',     -- visible to all users
        'rejected',     -- removed after review
        'archived'      -- soft-deleted by the author
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.user_role AS ENUM (
        'user',         -- standard member
        'moderator',    -- can review and approve/reject posts
        'admin'         -- full platform control
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE moderation.action_type AS ENUM (
        'approved',
        'rejected',
        'escalated',
        'dismissed'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Core Tables
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID        NOT NULL UNIQUE,  -- FK -> auth.users.id
    username        CITEXT      NOT NULL UNIQUE,
    display_name    TEXT,
    avatar_url      TEXT,
    bio             TEXT        CHECK (char_length(bio) <= 300),
    role            public.user_role NOT NULL DEFAULT 'user',
    is_suspended    BOOLEAN     NOT NULL DEFAULT FALSE,
    suspension_reason TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ,
    CONSTRAINT username_min_length CHECK (char_length(username) >= 3)
);

CREATE TABLE IF NOT EXISTS public.posts (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id       UUID        NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
    title           TEXT        NOT NULL CHECK (char_length(title)   BETWEEN 1 AND 300),
    body            TEXT        NOT NULL CHECK (char_length(body)     BETWEEN 1 AND 40000),
    media_urls      TEXT[]      NOT NULL DEFAULT '{}',
    image_url       TEXT,
    status          public.post_status NOT NULL DEFAULT 'pending',
    rejection_reason TEXT,
    is_nsfw         BOOLEAN     NOT NULL DEFAULT FALSE,
    is_pinned       BOOLEAN     NOT NULL DEFAULT FALSE,
    deleted_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    published_at    TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.admin_whitelist (
    email TEXT PRIMARY KEY
);

-- Seed admins
INSERT INTO public.admin_whitelist (email) VALUES 
('admin1@stbrittosacademy.edu.in'),
('admin2@stbrittosacademy.edu.in')
ON CONFLICT (email) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 4. Audit & Queue Tables
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS moderation.moderation_queue (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id         UUID        NOT NULL REFERENCES public.posts (id) ON DELETE CASCADE,
    assigned_to     UUID        REFERENCES public.profiles (id) ON DELETE SET NULL,
    reviewed_by     UUID        REFERENCES public.profiles (id) ON DELETE SET NULL,
    action          moderation.action_type,
    action_note     TEXT,
    ml_risk_score   NUMERIC(5, 4) CHECK (ml_risk_score BETWEEN 0 AND 1),
    is_escalated    BOOLEAN     NOT NULL DEFAULT FALSE,
    queued_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at     TIMESTAMPTZ,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 5. Indexes
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_profiles_user_id     ON public.profiles (user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role        ON public.profiles (role);
CREATE INDEX IF NOT EXISTS idx_profiles_username    ON public.profiles (username);
CREATE INDEX IF NOT EXISTS idx_profiles_deleted_at  ON public.profiles (deleted_at) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_posts_author_id    ON public.posts (author_id);
CREATE INDEX IF NOT EXISTS idx_posts_status       ON public.posts (status);
CREATE INDEX IF NOT EXISTS idx_posts_created_at   ON public.posts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_published_at ON public.posts (published_at DESC) WHERE status = 'approved';
CREATE INDEX IF NOT EXISTS idx_posts_deleted_at   ON public.posts (deleted_at) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_modq_post_id      ON moderation.moderation_queue (post_id);
CREATE INDEX IF NOT EXISTS idx_modq_assigned_to  ON moderation.moderation_queue (assigned_to);
CREATE INDEX IF NOT EXISTS idx_modq_action       ON moderation.moderation_queue (action);
CREATE INDEX IF NOT EXISTS idx_modq_queued_at    ON moderation.moderation_queue (queued_at DESC);
CREATE INDEX IF NOT EXISTS idx_modq_unreviewed   ON moderation.moderation_queue (queued_at DESC) WHERE action IS NULL;

-- ---------------------------------------------------------------------------
-- 6. Helper Functions & Triggers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_published_at_on_approve()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.status = 'approved' AND OLD.status <> 'approved' THEN
        NEW.published_at = NOW();
    END IF;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION moderation.set_reviewed_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.action IS NOT NULL AND OLD.action IS NULL THEN
        NEW.reviewed_at = NOW();
    END IF;
    RETURN NEW;
END;
$$;

-- Triggers for updated_at / reviewed_at
DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_posts_updated_at ON public.posts;
CREATE TRIGGER trg_posts_updated_at
    BEFORE UPDATE ON public.posts
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_posts_published_at ON public.posts;
CREATE TRIGGER trg_posts_published_at
    BEFORE UPDATE ON public.posts
    FOR EACH ROW EXECUTE FUNCTION public.set_published_at_on_approve();

DROP TRIGGER IF EXISTS trg_modq_updated_at ON moderation.moderation_queue;
CREATE TRIGGER trg_modq_updated_at
    BEFORE UPDATE ON moderation.moderation_queue
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_modq_reviewed_at ON moderation.moderation_queue;
CREATE TRIGGER trg_modq_reviewed_at
    BEFORE UPDATE ON moderation.moderation_queue
    FOR EACH ROW EXECUTE FUNCTION moderation.set_reviewed_at();

-- Enqueue trigger
CREATE OR REPLACE FUNCTION public.enqueue_post_for_moderation()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    INSERT INTO moderation.moderation_queue (post_id)
    VALUES (NEW.id);
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_posts_enqueue ON public.posts;
CREATE TRIGGER trg_posts_enqueue
    AFTER INSERT ON public.posts
    FOR EACH ROW EXECUTE FUNCTION public.enqueue_post_for_moderation();

-- Current Profile Helper
CREATE OR REPLACE FUNCTION public.current_profile()
RETURNS public.profiles LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT * FROM public.profiles
    WHERE user_id = auth.uid()
      AND deleted_at IS NULL
    LIMIT 1;
$$;

-- ---------------------------------------------------------------------------
-- 7. Social Graph Table & RPCs (follows)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.follows (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    follower_id   UUID        NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
    following_id  UUID        NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_follower_following UNIQUE (follower_id, following_id),
    CONSTRAINT self_follow_prevent CHECK (follower_id <> following_id)
);

CREATE INDEX IF NOT EXISTS idx_follows_follower   ON public.follows (follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following  ON public.follows (following_id);

CREATE OR REPLACE FUNCTION public.get_follower_count(profile_id UUID)
RETURNS BIGINT LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT COUNT(*) FROM public.follows
    WHERE following_id = profile_id;
$$;

CREATE OR REPLACE FUNCTION public.get_following_count(profile_id UUID)
RETURNS BIGINT LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT COUNT(*) FROM public.follows
    WHERE follower_id = profile_id;
$$;

-- ---------------------------------------------------------------------------
-- 8. Achievements Schema & Auth SignUp triggers
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.achievements (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id  UUID        NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
    badge_type  TEXT        NOT NULL,
    title       TEXT        NOT NULL,
    description TEXT        NOT NULL,
    earned_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_achievements_profile_id ON public.achievements (profile_id);

CREATE OR REPLACE FUNCTION public.handle_new_user_signup()
RETURNS TRIGGER AS $$
DECLARE
    new_username CITEXT;
    new_display_name TEXT;
    assigned_role public.user_role;
BEGIN
    new_username := COALESCE(
        (NEW.raw_user_meta_data->>'username')::CITEXT, 
        'user_' || substring(NEW.id::text from 1 for 8)
    );
    
    new_display_name := COALESCE(
        NEW.raw_user_meta_data->>'display_name',
        NEW.raw_user_meta_data->>'username',
        'Spark Student'
    );

    IF EXISTS (SELECT 1 FROM public.admin_whitelist WHERE email = NEW.email) THEN
        assigned_role := 'admin';
    ELSE
        assigned_role := 'user';
    END IF;

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

DROP TRIGGER IF EXISTS trg_auth_user_created ON auth.users;
CREATE TRIGGER trg_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user_signup();

-- Admin whitelist triggers
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

-- ---------------------------------------------------------------------------
-- 9. Interactions Tables (likes, comments, bookmarks)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.likes (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id     UUID        NOT NULL REFERENCES public.posts (id) ON DELETE CASCADE,
    profile_id  UUID        NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_post_profile_like UNIQUE (post_id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_likes_post_id    ON public.likes (post_id);
CREATE INDEX IF NOT EXISTS idx_likes_profile_id ON public.likes (profile_id);

CREATE TABLE IF NOT EXISTS public.comments (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id     UUID        NOT NULL REFERENCES public.posts (id) ON DELETE CASCADE,
    profile_id  UUID        NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
    body        TEXT        NOT NULL CHECK (char_length(body) >= 1 AND char_length(body) <= 10000),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comments_post_id    ON public.comments (post_id);
CREATE INDEX IF NOT EXISTS idx_comments_profile_id ON public.comments (profile_id);
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON public.comments (created_at ASC);

CREATE TABLE IF NOT EXISTS public.bookmarks (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id     UUID        NOT NULL REFERENCES public.posts (id) ON DELETE CASCADE,
    profile_id  UUID        NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_post_profile_bookmark UNIQUE (post_id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_bookmarks_profile_id ON public.bookmarks (profile_id);

-- ---------------------------------------------------------------------------
-- 10. Storage Setup (Bucket & Object Policies)
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('post-images', 'post-images', true)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 11. Security Hardening Patch (IDOR, RLS, and Privilege Escalation Prevention)
-- ---------------------------------------------------------------------------

-- A. is_admin() RPC
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.admin_whitelist
        WHERE email = auth.jwt()->>'email'
    );
END;
$$;

-- B. toggle_follow() with IDOR safety check
CREATE OR REPLACE FUNCTION public.toggle_follow(follower_id_param UUID, following_id_param UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    is_following BOOLEAN;
    calling_profile_id UUID;
BEGIN
    calling_profile_id := (public.current_profile()).id;

    IF follower_id_param IS DISTINCT FROM calling_profile_id THEN
        RAISE EXCEPTION 'Access Denied: You cannot toggle follows on behalf of another profile (IDOR prevention).';
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM public.follows
        WHERE follower_id = follower_id_param AND following_id = following_id_param
    ) INTO is_following;

    IF is_following THEN
        DELETE FROM public.follows
        WHERE follower_id = follower_id_param AND following_id = following_id_param;
        RETURN FALSE;
    ELSE
        INSERT INTO public.follows (follower_id, following_id)
        VALUES (follower_id_param, following_id_param);
        RETURN TRUE;
    END IF;
END;
$$;

-- C. Profiles Update Protection Trigger (Security Patch)
CREATE OR REPLACE FUNCTION public.check_profile_update_privileges()
RETURNS TRIGGER AS $$
BEGIN
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

DROP TRIGGER IF EXISTS trg_check_profile_update_privileges ON public.profiles;
CREATE TRIGGER trg_check_profile_update_privileges
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.check_profile_update_privileges();

-- D. Posts Status Modification trigger (Security Patch)
CREATE OR REPLACE FUNCTION public.check_post_update_privileges()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.admin_whitelist
            WHERE email = auth.jwt()->>'email'
        ) AND (public.current_profile()).role NOT IN ('moderator', 'admin') THEN
            RAISE EXCEPTION 'Access Denied: Only moderators and administrators can modify post status.';
        END IF;
    END IF;

    IF OLD.status IN ('rejected', 'archived') AND (public.current_profile()).role NOT IN ('moderator', 'admin') THEN
        RAISE EXCEPTION 'Access Denied: You cannot modify a rejected or archived post.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_check_post_update_privileges ON public.posts;
CREATE TRIGGER trg_check_post_update_privileges
    BEFORE UPDATE ON public.posts
    FOR EACH ROW EXECUTE FUNCTION public.check_post_update_privileges();

-- ---------------------------------------------------------------------------
-- 12. Row-Level Security Enforce & Policies Definition
-- ---------------------------------------------------------------------------

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE moderation.moderation_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;

-- ── Profiles Policies ──
DROP POLICY IF EXISTS profiles_select_public ON public.profiles;
CREATE POLICY profiles_select_public ON public.profiles FOR SELECT USING (deleted_at IS NULL);

DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE USING ((current_profile()).user_id = user_id);

DROP POLICY IF EXISTS profiles_insert_admin ON public.profiles;
CREATE POLICY profiles_insert_admin ON public.profiles FOR INSERT WITH CHECK ((current_profile()).role = 'admin');

DROP POLICY IF EXISTS profiles_delete_admin ON public.profiles;
CREATE POLICY profiles_delete_admin ON public.profiles FOR DELETE USING ((current_profile()).role = 'admin');

-- ── Posts Policies ──
DROP POLICY IF EXISTS posts_select_approved ON public.posts;
CREATE POLICY posts_select_approved ON public.posts FOR SELECT USING (status = 'approved' AND deleted_at IS NULL);

DROP POLICY IF EXISTS posts_select_own ON public.posts;
CREATE POLICY posts_select_own ON public.posts FOR SELECT USING (author_id = (current_profile()).id AND deleted_at IS NULL);

DROP POLICY IF EXISTS posts_select_moderator ON public.posts;
CREATE POLICY posts_select_moderator ON public.posts FOR SELECT USING ((current_profile()).role IN ('moderator', 'admin') AND deleted_at IS NULL);

DROP POLICY IF EXISTS posts_insert_authenticated ON public.posts;
CREATE POLICY posts_insert_authenticated ON public.posts FOR INSERT WITH CHECK (
    author_id = (current_profile()).id
    AND (current_profile()).is_suspended = FALSE
    AND status = 'pending'
);

DROP POLICY IF EXISTS posts_update_own_content ON public.posts;
CREATE POLICY posts_update_own_content ON public.posts FOR UPDATE USING (
    author_id = (current_profile()).id
    AND status IN ('pending', 'approved')
    AND deleted_at IS NULL
) WITH CHECK (status = OLD.status);

DROP POLICY IF EXISTS posts_update_status_moderator ON public.posts;
CREATE POLICY posts_update_status_moderator ON public.posts FOR UPDATE USING (
    (current_profile()).role IN ('moderator', 'admin')
    AND deleted_at IS NULL
) WITH CHECK ((current_profile()).role IN ('moderator', 'admin'));

DROP POLICY IF EXISTS posts_delete_admin ON public.posts;
CREATE POLICY posts_delete_admin ON public.posts FOR DELETE USING ((current_profile()).role = 'admin');

-- ── Moderation Queue Policies ──
DROP POLICY IF EXISTS modq_select_moderator ON moderation.moderation_queue;
CREATE POLICY modq_select_moderator ON moderation.moderation_queue FOR SELECT USING ((current_profile()).role IN ('moderator', 'admin'));

DROP POLICY IF EXISTS modq_insert_service ON moderation.moderation_queue;
CREATE POLICY modq_insert_service ON moderation.moderation_queue FOR INSERT WITH CHECK ((current_profile()).role IN ('moderator', 'admin'));

DROP POLICY IF EXISTS modq_update_moderator ON moderation.moderation_queue;
CREATE POLICY modq_update_moderator ON moderation.moderation_queue FOR UPDATE USING ((current_profile()).role IN ('moderator', 'admin')) WITH CHECK ((current_profile()).role IN ('moderator', 'admin'));

-- ── Follows Policies ──
DROP POLICY IF EXISTS follows_select_public ON public.follows;
CREATE POLICY follows_select_public ON public.follows FOR SELECT USING (true);

DROP POLICY IF EXISTS follows_insert_own ON public.follows;
CREATE POLICY follows_insert_own ON public.follows FOR INSERT WITH CHECK (follower_id = (public.current_profile()).id);

DROP POLICY IF EXISTS follows_delete_own ON public.follows;
CREATE POLICY follows_delete_own ON public.follows FOR DELETE USING (follower_id = (public.current_profile()).id);

-- ── Achievements Policies ──
DROP POLICY IF EXISTS achievements_select_public ON public.achievements;
CREATE POLICY achievements_select_public ON public.achievements FOR SELECT USING (true);

DROP POLICY IF EXISTS achievements_write_admin ON public.achievements;
CREATE POLICY achievements_write_admin ON public.achievements FOR ALL USING ((public.current_profile()).role = 'admin') WITH CHECK ((public.current_profile()).role = 'admin');

-- ── Likes Policies ──
DROP POLICY IF EXISTS likes_select_public ON public.likes;
CREATE POLICY likes_select_public ON public.likes FOR SELECT USING (true);

DROP POLICY IF EXISTS likes_insert_own ON public.likes;
CREATE POLICY likes_insert_own ON public.likes FOR INSERT WITH CHECK (profile_id = (public.current_profile()).id);

DROP POLICY IF EXISTS likes_delete_own ON public.likes;
CREATE POLICY likes_delete_own ON public.likes FOR DELETE USING (profile_id = (public.current_profile()).id);

-- ── Comments Policies ──
DROP POLICY IF EXISTS comments_select_public ON public.comments;
CREATE POLICY comments_select_public ON public.comments FOR SELECT USING (true);

DROP POLICY IF EXISTS comments_insert_own ON public.comments;
CREATE POLICY comments_insert_own ON public.comments FOR INSERT WITH CHECK (profile_id = (public.current_profile()).id);

DROP POLICY IF EXISTS comments_update_own ON public.comments;
CREATE POLICY comments_update_own ON public.comments FOR UPDATE USING (profile_id = (public.current_profile()).id);

DROP POLICY IF EXISTS comments_delete_own ON public.comments;
CREATE POLICY comments_delete_own ON public.comments FOR DELETE USING (profile_id = (public.current_profile()).id);

-- ── Bookmarks Policies ──
DROP POLICY IF EXISTS bookmarks_select_own ON public.bookmarks;
CREATE POLICY bookmarks_select_own ON public.bookmarks FOR SELECT USING (profile_id = (public.current_profile()).id);

DROP POLICY IF EXISTS bookmarks_insert_own ON public.bookmarks;
CREATE POLICY bookmarks_insert_own ON public.bookmarks FOR INSERT WITH CHECK (profile_id = (public.current_profile()).id);

DROP POLICY IF EXISTS bookmarks_delete_own ON public.bookmarks;
CREATE POLICY bookmarks_delete_own ON public.bookmarks FOR DELETE USING (profile_id = (public.current_profile()).id);

-- ── Storage Bucket Policies ──
DROP POLICY IF EXISTS "Allow Public Select on post-images" ON storage.objects;
CREATE POLICY "Allow Public Select on post-images" ON storage.objects FOR SELECT USING (bucket_id = 'post-images');

DROP POLICY IF EXISTS "Allow Authenticated Insert on post-images" ON storage.objects;
CREATE POLICY "Allow Authenticated Insert on post-images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'post-images' AND auth.uid()::text = owner);

DROP POLICY IF EXISTS "Allow Authenticated Owner Modification on post-images" ON storage.objects;
CREATE POLICY "Allow Authenticated Owner Modification on post-images" ON storage.objects FOR ALL TO authenticated USING (bucket_id = 'post-images' AND auth.uid() = owner);

-- ---------------------------------------------------------------------------
-- 13. System Grants
-- ---------------------------------------------------------------------------
GRANT SELECT ON public.profiles            TO anon, authenticated;
GRANT SELECT ON public.posts               TO anon, authenticated;
GRANT SELECT ON public.admin_whitelist     TO anon, authenticated;
GRANT SELECT ON public.follows             TO anon, authenticated;
GRANT SELECT ON public.achievements        TO anon, authenticated;
GRANT SELECT ON public.likes               TO anon, authenticated;
GRANT SELECT ON public.comments            TO anon, authenticated;

GRANT SELECT, INSERT, UPDATE ON public.profiles            TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.posts               TO authenticated;
GRANT SELECT, INSERT, UPDATE ON moderation.moderation_queue TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.follows             TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.likes               TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comments    TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.bookmarks           TO authenticated;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_follower_count(UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_following_count(UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.toggle_follow(UUID, UUID) TO authenticated, anon;

GRANT ALL ON public.profiles               TO service_role;
GRANT ALL ON public.posts                  TO service_role;
GRANT ALL ON moderation.moderation_queue   TO service_role;
GRANT ALL ON public.admin_whitelist        TO service_role;
GRANT ALL ON public.follows                TO service_role;
GRANT ALL ON public.achievements           TO service_role;
GRANT ALL ON public.likes                  TO service_role;
GRANT ALL ON public.comments               TO service_role;
GRANT ALL ON public.bookmarks              TO service_role;
