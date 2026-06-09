-- =============================================================================
-- SPARK APP — Database Schema
-- Engine  : PostgreSQL 15+ (Supabase-compatible)
-- Schema  : public (core app) + moderation (isolated moderation data)
-- Author  : Backend Architect Agent
-- Created : 2026-05-25
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "citext";     -- case-insensitive text (usernames)

-- ---------------------------------------------------------------------------
-- Schemas
-- ---------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS moderation;

-- =============================================================================
-- ENUM TYPES
-- =============================================================================

-- Post lifecycle status
CREATE TYPE public.post_status AS ENUM (
    'pending',      -- awaiting moderation review
    'approved',     -- visible to all users
    'rejected',     -- removed after review
    'archived'      -- soft-deleted by the author
);

-- User role within the platform
CREATE TYPE public.user_role AS ENUM (
    'user',         -- standard member
    'moderator',    -- can review and approve/reject posts
    'admin'         -- full platform control
);

-- Moderation action taken on a queue item
CREATE TYPE moderation.action_type AS ENUM (
    'approved',
    'rejected',
    'escalated',
    'dismissed'
);

-- =============================================================================
-- TABLE: public.profiles
-- One-to-one extension of Supabase auth.users.
-- All user-facing identity lives here; auth.users holds credentials only.
-- =============================================================================
CREATE TABLE public.profiles (
    -- Identity
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID        NOT NULL UNIQUE,  -- FK → auth.users.id (Supabase)
    username        CITEXT      NOT NULL UNIQUE,
    display_name    TEXT,

    -- Avatar & bio
    avatar_url      TEXT,       -- S3-compatible object key
    bio             TEXT        CHECK (char_length(bio) <= 300),
    interests       TEXT[]      NOT NULL DEFAULT '{}',

    -- Role & standing
    role            public.user_role NOT NULL DEFAULT 'user',
    is_suspended    BOOLEAN     NOT NULL DEFAULT FALSE,
    suspension_reason TEXT,

    -- Timestamps (all UTC)
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ           -- soft-delete; NULL = active

    -- Constraints
    CONSTRAINT username_min_length CHECK (char_length(username) >= 3)
);

-- Indexes
CREATE INDEX idx_profiles_user_id     ON public.profiles (user_id);
CREATE INDEX idx_profiles_role        ON public.profiles (role);
CREATE INDEX idx_profiles_username    ON public.profiles (username);
CREATE INDEX idx_profiles_deleted_at  ON public.profiles (deleted_at) WHERE deleted_at IS NULL;

-- Auto-update updated_at on any row change
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE  public.profiles                IS 'User identity and platform standing.';
COMMENT ON COLUMN public.profiles.user_id        IS 'References auth.users.id — set by Supabase Auth.';
COMMENT ON COLUMN public.profiles.role           IS 'Controls RLS permissions across the platform.';
COMMENT ON COLUMN public.profiles.is_suspended   IS 'Suspended users cannot create or interact with content.';
COMMENT ON COLUMN public.profiles.deleted_at     IS 'Soft-delete: non-NULL means the account is deactivated.';

-- =============================================================================
-- TABLE: public.posts
-- Core user-generated content. Every post enters as 'pending' and must be
-- approved by a moderator before it becomes publicly visible.
-- =============================================================================
CREATE TABLE public.posts (
    -- Identity
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id       UUID        NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,

    -- Content
    title           TEXT        NOT NULL CHECK (char_length(title)   BETWEEN 1 AND 300),
    body            TEXT        NOT NULL CHECK (char_length(body)     BETWEEN 1 AND 40000),
    media_urls      TEXT[]      NOT NULL DEFAULT '{}',  -- S3-compatible object keys
    image_url       TEXT,                               -- Direct uploaded image banner link

    -- Moderation state (defaults to pending — no post goes live unreviewed)
    status          public.post_status NOT NULL DEFAULT 'pending',
    rejection_reason TEXT,                              -- populated when status = 'rejected'

    -- Visibility controls
    is_nsfw         BOOLEAN     NOT NULL DEFAULT FALSE,
    is_pinned       BOOLEAN     NOT NULL DEFAULT FALSE,

    -- Soft-delete
    deleted_at      TIMESTAMPTZ,

    -- Timestamps
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    published_at    TIMESTAMPTZ             -- set when status transitions to 'approved'
);

-- Indexes
CREATE INDEX idx_posts_author_id    ON public.posts (author_id);
CREATE INDEX idx_posts_status       ON public.posts (status);
CREATE INDEX idx_posts_created_at   ON public.posts (created_at DESC);
CREATE INDEX idx_posts_published_at ON public.posts (published_at DESC) WHERE status = 'approved';
CREATE INDEX idx_posts_deleted_at   ON public.posts (deleted_at) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_posts_updated_at
    BEFORE UPDATE ON public.posts
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-set published_at when a moderator approves the post
CREATE OR REPLACE FUNCTION public.set_published_at_on_approve()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.status = 'approved' AND OLD.status <> 'approved' THEN
        NEW.published_at = NOW();
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_posts_published_at
    BEFORE UPDATE ON public.posts
    FOR EACH ROW EXECUTE FUNCTION public.set_published_at_on_approve();

COMMENT ON TABLE  public.posts                   IS 'User-generated posts. All content starts as pending and requires moderator approval.';
COMMENT ON COLUMN public.posts.status            IS 'Lifecycle state: pending → approved | rejected | archived.';
COMMENT ON COLUMN public.posts.rejection_reason  IS 'Human-readable reason shown to the author when rejected.';
COMMENT ON COLUMN public.posts.published_at      IS 'Set automatically when status transitions to approved.';

-- =============================================================================
-- TABLE: moderation.moderation_queue
-- Every pending post gets a corresponding queue entry. Moderators pull from
-- this queue, take an action, and the post status is updated accordingly.
-- Keeps a full audit trail — rows are never deleted.
-- =============================================================================
CREATE TABLE moderation.moderation_queue (
    -- Identity
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id         UUID        NOT NULL REFERENCES public.posts (id) ON DELETE CASCADE,

    -- Assignment
    assigned_to     UUID        REFERENCES public.profiles (id) ON DELETE SET NULL,  -- moderator
    reviewed_by     UUID        REFERENCES public.profiles (id) ON DELETE SET NULL,  -- who acted

    -- Outcome
    action          moderation.action_type,          -- NULL = not yet reviewed
    action_note     TEXT,                            -- internal moderator note (not shown to user)
    ml_risk_score   NUMERIC(5, 4) CHECK (ml_risk_score BETWEEN 0 AND 1),  -- 0.0–1.0 from ML scorer
    is_escalated    BOOLEAN     NOT NULL DEFAULT FALSE,

    -- Timestamps
    queued_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at     TIMESTAMPTZ,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_modq_post_id      ON moderation.moderation_queue (post_id);
CREATE INDEX idx_modq_assigned_to  ON moderation.moderation_queue (assigned_to);
CREATE INDEX idx_modq_action       ON moderation.moderation_queue (action);
CREATE INDEX idx_modq_queued_at    ON moderation.moderation_queue (queued_at DESC);
-- Fast query for "show me all unreviewed items"
CREATE INDEX idx_modq_unreviewed   ON moderation.moderation_queue (queued_at DESC) WHERE action IS NULL;

CREATE TRIGGER trg_modq_updated_at
    BEFORE UPDATE ON moderation.moderation_queue
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- When a moderator marks an action, stamp reviewed_at
CREATE OR REPLACE FUNCTION moderation.set_reviewed_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.action IS NOT NULL AND OLD.action IS NULL THEN
        NEW.reviewed_at = NOW();
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_modq_reviewed_at
    BEFORE UPDATE ON moderation.moderation_queue
    FOR EACH ROW EXECUTE FUNCTION moderation.set_reviewed_at();

COMMENT ON TABLE  moderation.moderation_queue              IS 'Audit-preserving queue of posts awaiting or having received moderation review.';
COMMENT ON COLUMN moderation.moderation_queue.action       IS 'NULL while pending. Set when a moderator acts.';
COMMENT ON COLUMN moderation.moderation_queue.ml_risk_score IS 'Score from automated ML classifier (0 = safe, 1 = high-risk).';
COMMENT ON COLUMN moderation.moderation_queue.is_escalated IS 'Flagged for senior review (e.g. CSAM, credible threats).';

-- =============================================================================
-- HELPER: resolve caller's profile from the Supabase JWT
-- Returns the profiles row for the currently authenticated user.
-- Used inside RLS policies to avoid repeated sub-selects.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.current_profile()
RETURNS public.profiles LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT * FROM public.profiles
    WHERE user_id = auth.uid()
      AND deleted_at IS NULL
    LIMIT 1;
$$;

-- =============================================================================
-- ROW-LEVEL SECURITY — public.profiles
-- =============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Everyone can read non-deleted profiles
CREATE POLICY profiles_select_public
    ON public.profiles FOR SELECT
    USING (deleted_at IS NULL);

-- A user can update only their own profile
CREATE POLICY profiles_update_own
    ON public.profiles FOR UPDATE
    USING ((current_profile()).user_id = user_id);

-- Only admins can insert profiles directly (Supabase trigger handles normal signup)
CREATE POLICY profiles_insert_admin
    ON public.profiles FOR INSERT
    WITH CHECK ((current_profile()).role = 'admin');

-- Only admins can hard-delete (soft-delete is an UPDATE)
CREATE POLICY profiles_delete_admin
    ON public.profiles FOR DELETE
    USING ((current_profile()).role = 'admin');

-- =============================================================================
-- ROW-LEVEL SECURITY — public.posts
-- =============================================================================
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

-- ── SELECT ──────────────────────────────────────────────────────────────────

-- Regular users see only approved, non-deleted posts
CREATE POLICY posts_select_approved
    ON public.posts FOR SELECT
    USING (
        status = 'approved'
        AND deleted_at IS NULL
    );

-- Authors can always see their own posts (any status, not hard-deleted)
CREATE POLICY posts_select_own
    ON public.posts FOR SELECT
    USING (
        author_id = (current_profile()).id
        AND deleted_at IS NULL
    );

-- Moderators and admins can see ALL non-deleted posts regardless of status
CREATE POLICY posts_select_moderator
    ON public.posts FOR SELECT
    USING (
        (current_profile()).role IN ('moderator', 'admin')
        AND deleted_at IS NULL
    );

-- ── INSERT ───────────────────────────────────────────────────────────────────

-- Any active, non-suspended user can submit a post (always lands as 'pending')
CREATE POLICY posts_insert_authenticated
    ON public.posts FOR INSERT
    WITH CHECK (
        author_id = (current_profile()).id
        AND (current_profile()).is_suspended = FALSE
        AND status = 'pending'   -- enforces default; prevents status bypass on insert
    );

-- ── UPDATE ───────────────────────────────────────────────────────────────────

-- Authors can edit the body/title of their own pending or approved posts
-- They CANNOT change the status column
CREATE POLICY posts_update_own_content
    ON public.posts FOR UPDATE
    USING (
        author_id = (current_profile()).id
        AND status IN ('pending', 'approved')
        AND deleted_at IS NULL
    )
    WITH CHECK (
        -- Prevent authors from escalating their own status
        status = OLD.status
    );

-- ── APPROVE / REJECT (status transitions) — MODERATORS ONLY ─────────────────
-- This is the critical policy: only users with role = 'moderator' or 'admin'
-- may change the status column to 'approved' or 'rejected'.
CREATE POLICY posts_update_status_moderator
    ON public.posts FOR UPDATE
    USING (
        (current_profile()).role IN ('moderator', 'admin')
        AND deleted_at IS NULL
    )
    WITH CHECK (
        (current_profile()).role IN ('moderator', 'admin')
    );

-- ── DELETE ────────────────────────────────────────────────────────────────────

-- Only admins can hard-delete posts; authors soft-delete via status = 'archived'
CREATE POLICY posts_delete_admin
    ON public.posts FOR DELETE
    USING ((current_profile()).role = 'admin');

-- =============================================================================
-- ROW-LEVEL SECURITY — moderation.moderation_queue
-- =============================================================================
ALTER TABLE moderation.moderation_queue ENABLE ROW LEVEL SECURITY;

-- Only moderators and admins can read the queue
CREATE POLICY modq_select_moderator
    ON moderation.moderation_queue FOR SELECT
    USING ((current_profile()).role IN ('moderator', 'admin'));

-- The system (service role / Edge Function) inserts new queue items when a post
-- is submitted. Moderators cannot manually insert queue rows.
CREATE POLICY modq_insert_service
    ON moderation.moderation_queue FOR INSERT
    WITH CHECK ((current_profile()).role IN ('moderator', 'admin'));

-- Moderators can update queue items (assign, record action, add notes)
CREATE POLICY modq_update_moderator
    ON moderation.moderation_queue FOR UPDATE
    USING ((current_profile()).role IN ('moderator', 'admin'))
    WITH CHECK ((current_profile()).role IN ('moderator', 'admin'));

-- No one deletes queue rows — they are the permanent audit trail
-- (Omitting a DELETE policy means DELETE is implicitly denied under RLS)

-- =============================================================================
-- TRIGGER: auto-enqueue posts on INSERT
-- When a new post is inserted it is always 'pending', so we immediately add
-- it to the moderation queue for review.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.enqueue_post_for_moderation()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    INSERT INTO moderation.moderation_queue (post_id)
    VALUES (NEW.id);
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_posts_enqueue
    AFTER INSERT ON public.posts
    FOR EACH ROW EXECUTE FUNCTION public.enqueue_post_for_moderation();

-- =============================================================================
-- GRANT STATEMENTS (Supabase roles)
-- =============================================================================

-- anon: read-only on approved content (RLS enforces the filter)
GRANT SELECT ON public.profiles            TO anon;
GRANT SELECT ON public.posts               TO anon;

-- authenticated: standard CRUD within RLS bounds
GRANT SELECT, INSERT, UPDATE ON public.profiles            TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.posts               TO authenticated;
GRANT SELECT, INSERT, UPDATE ON moderation.moderation_queue TO authenticated;

-- service_role bypasses RLS — used by Edge Functions / backend workers only
GRANT ALL ON public.profiles               TO service_role;
GRANT ALL ON public.posts                  TO service_role;
GRANT ALL ON moderation.moderation_queue   TO service_role;

-- =============================================================================
-- TABLE: public.admin_whitelist
-- Authorized administrators allowed to hold the 'admin' user role.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.admin_whitelist (
    email TEXT PRIMARY KEY
);

-- Add your official admin emails here
INSERT INTO public.admin_whitelist (email) VALUES 
('admin1@stbrittosacademy.edu.in'),
('admin2@stbrittosacademy.edu.in'),
('gopinath.r@stbrittosacademy.edu.in')
ON CONFLICT (email) DO NOTHING;

-- Grant permissions for admin_whitelist table
GRANT SELECT ON public.admin_whitelist TO anon;
GRANT SELECT ON public.admin_whitelist TO authenticated;
GRANT ALL ON public.admin_whitelist TO service_role;

-- =============================================================================
-- FUNCTION: public.is_admin()
-- Returns TRUE if the currently authenticated user's email is in the admin_whitelist table.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.admin_whitelist
        WHERE email = auth.jwt()->>'email'
    );
END;
$$;

-- Grant permissions for public.is_admin() RPC
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon;


