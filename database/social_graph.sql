-- =============================================================================
-- SPARK APP — Social Graph Schema & RPCs
-- Migration File: Adds follows table, triggers, and count metrics functions
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Table: public.follows
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.follows (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    follower_id   UUID        NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
    following_id  UUID        NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT unique_follower_following UNIQUE (follower_id, following_id),
    CONSTRAINT self_follow_prevent CHECK (follower_id <> following_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_follows_follower   ON public.follows (follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following  ON public.follows (following_id);

-- RLS policies for follows
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

-- 1. Any active user can read follows records
CREATE POLICY follows_select_public
    ON public.follows FOR SELECT
    USING (true);

-- 2. Users can only insert follow relations where they are the follower
CREATE POLICY follows_insert_own
    ON public.follows FOR INSERT
    WITH CHECK (follower_id = (public.current_profile()).id);

-- 3. Users can only delete follow relations where they are the follower
CREATE POLICY follows_delete_own
    ON public.follows FOR DELETE
    USING (follower_id = (public.current_profile()).id);

-- -----------------------------------------------------------------------------
-- 2. Database Helper Metrics Functions (RPCs)
-- -----------------------------------------------------------------------------

-- Get follower count of a specific profile
CREATE OR REPLACE FUNCTION public.get_follower_count(profile_id UUID)
RETURNS BIGINT LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT COUNT(*) FROM public.follows
    WHERE following_id = profile_id;
$$;

-- Get following count of a specific profile
CREATE OR REPLACE FUNCTION public.get_following_count(profile_id UUID)
RETURNS BIGINT LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT COUNT(*) FROM public.follows
    WHERE follower_id = profile_id;
$$;

-- Toggle follow status inside the database atomically (RPC)
CREATE OR REPLACE FUNCTION public.toggle_follow(follower_id_param UUID, following_id_param UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    is_following BOOLEAN;
BEGIN
    -- Check if follow relation exists
    SELECT EXISTS (
        SELECT 1 FROM public.follows
        WHERE follower_id = follower_id_param AND following_id = following_id_param
    ) INTO is_following;

    IF is_following THEN
        -- Unfollow
        DELETE FROM public.follows
        WHERE follower_id = follower_id_param AND following_id = following_id_param;
        RETURN FALSE; -- now not following
    ELSE
        -- Follow
        INSERT INTO public.follows (follower_id, following_id)
        VALUES (follower_id_param, following_id_param);
        RETURN TRUE; -- now following
    END IF;
END;
$$;

COMMENT ON TABLE  public.follows                   IS 'Social network follow relationships graph.';
COMMENT ON COLUMN public.follows.follower_id       IS 'The profile initiating the follow action.';
COMMENT ON COLUMN public.follows.following_id      IS 'The profile receiving the follow connection.';
COMMENT ON FUNCTION public.get_follower_count(UUID) IS 'Counts follow relationships where following_id matches target profile.';
COMMENT ON FUNCTION public.get_following_count(UUID) IS 'Counts follow relationships where follower_id matches target profile.';
COMMENT ON FUNCTION public.toggle_follow(UUID, UUID) IS 'Atomically toggles a follow relationship between follower and following.';
