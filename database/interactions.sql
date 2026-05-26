-- =============================================================================
-- SPARK APP — User Interactions Schema
-- Migration File: Adds likes, comments, and bookmarks tables with RLS
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Table: public.likes
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.likes (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id     UUID        NOT NULL REFERENCES public.posts (id) ON DELETE CASCADE,
    profile_id  UUID        NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraint: A profile can only like a post once
    CONSTRAINT unique_post_profile_like UNIQUE (post_id, profile_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_likes_post_id    ON public.likes (post_id);
CREATE INDEX IF NOT EXISTS idx_likes_profile_id ON public.likes (profile_id);

-- Enable RLS
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY likes_select_public ON public.likes 
    FOR SELECT USING (true);

CREATE POLICY likes_insert_own ON public.likes 
    FOR INSERT WITH CHECK (profile_id = (public.current_profile()).id);

CREATE POLICY likes_delete_own ON public.likes 
    FOR DELETE USING (profile_id = (public.current_profile()).id);

-- -----------------------------------------------------------------------------
-- 2. Table: public.comments
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.comments (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id     UUID        NOT NULL REFERENCES public.posts (id) ON DELETE CASCADE,
    profile_id  UUID        NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
    body        TEXT        NOT NULL CHECK (char_length(body) >= 1 AND char_length(body) <= 10000),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_comments_post_id    ON public.comments (post_id);
CREATE INDEX IF NOT EXISTS idx_comments_profile_id ON public.comments (profile_id);
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON public.comments (created_at ASC);

-- Enable RLS
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY comments_select_public ON public.comments 
    FOR SELECT USING (true);

CREATE POLICY comments_insert_own ON public.comments 
    FOR INSERT WITH CHECK (profile_id = (public.current_profile()).id);

CREATE POLICY comments_update_own ON public.comments 
    FOR UPDATE USING (profile_id = (public.current_profile()).id);

CREATE POLICY comments_delete_own ON public.comments 
    FOR DELETE USING (profile_id = (public.current_profile()).id);

-- -----------------------------------------------------------------------------
-- 3. Table: public.bookmarks
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bookmarks (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id     UUID        NOT NULL REFERENCES public.posts (id) ON DELETE CASCADE,
    profile_id  UUID        NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraint: A profile can only bookmark a post once
    CONSTRAINT unique_post_profile_bookmark UNIQUE (post_id, profile_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_bookmarks_profile_id ON public.bookmarks (profile_id);

-- Enable RLS
ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;

-- Policies: Bookmarks are private to the user who saved them
CREATE POLICY bookmarks_select_own ON public.bookmarks 
    FOR SELECT USING (profile_id = (public.current_profile()).id);

CREATE POLICY bookmarks_insert_own ON public.bookmarks 
    FOR INSERT WITH CHECK (profile_id = (public.current_profile()).id);

CREATE POLICY bookmarks_delete_own ON public.bookmarks 
    FOR DELETE USING (profile_id = (public.current_profile()).id);

-- -----------------------------------------------------------------------------
-- Grants
-- -----------------------------------------------------------------------------
GRANT SELECT ON public.likes TO anon, authenticated;
GRANT INSERT, DELETE ON public.likes TO authenticated;

GRANT SELECT ON public.comments TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.comments TO authenticated;

GRANT SELECT, INSERT, DELETE ON public.bookmarks TO authenticated;

COMMENT ON TABLE public.likes IS 'User likes on posts.';
COMMENT ON TABLE public.comments IS 'User comments on posts.';
COMMENT ON TABLE public.bookmarks IS 'User private saved posts bookmarks.';
