-- =============================================================================
-- SPARK APP — Realtime Schema
-- Adds: notifications, direct_messages tables with RLS + auto-trigger functions
-- Run this AFTER full_setup.sql in the Supabase SQL Editor
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. TABLE: public.notifications
-- Auto-created by server-side triggers when interactions occur.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_id    UUID        NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
    actor_id        UUID        REFERENCES public.profiles (id) ON DELETE SET NULL,
    -- type: 'like' | 'comment' | 'follow' | 'post_approved' | 'post_rejected'
    type            TEXT        NOT NULL CHECK (type IN ('like','comment','follow','post_approved','post_rejected')),
    post_id         UUID        REFERENCES public.posts (id) ON DELETE CASCADE,
    message         TEXT,       -- human-readable preview text
    read            BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_id ON public.notifications (recipient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read         ON public.notifications (recipient_id, read) WHERE read = FALSE;
CREATE INDEX IF NOT EXISTS idx_notifications_created_at   ON public.notifications (created_at DESC);

-- RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notifications_select_own ON public.notifications;
CREATE POLICY notifications_select_own ON public.notifications
    FOR SELECT USING (recipient_id = (public.current_profile()).id);

DROP POLICY IF EXISTS notifications_update_own ON public.notifications;
CREATE POLICY notifications_update_own ON public.notifications
    FOR UPDATE USING (recipient_id = (public.current_profile()).id);

DROP POLICY IF EXISTS notifications_insert_service ON public.notifications;
CREATE POLICY notifications_insert_service ON public.notifications
    FOR INSERT WITH CHECK (true); -- triggers use SECURITY DEFINER

DROP POLICY IF EXISTS notifications_delete_own ON public.notifications;
CREATE POLICY notifications_delete_own ON public.notifications
    FOR DELETE USING (recipient_id = (public.current_profile()).id);

-- Grants
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

-- Enable Supabase Realtime
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
          AND schemaname = 'public' 
          AND tablename = 'notifications'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
    END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. TRIGGER FUNCTIONS: Auto-create notifications on interactions
-- ---------------------------------------------------------------------------

-- Trigger: notify on like
CREATE OR REPLACE FUNCTION public.notify_on_like()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    post_author_id UUID;
    actor_username TEXT;
BEGIN
    -- Get post author
    SELECT author_id INTO post_author_id FROM public.posts WHERE id = NEW.post_id;
    -- Don't notify yourself
    IF post_author_id IS NOT DISTINCT FROM NEW.profile_id THEN
        RETURN NEW;
    END IF;
    -- Get actor username for message
    SELECT username INTO actor_username FROM public.profiles WHERE id = NEW.profile_id;

    INSERT INTO public.notifications (recipient_id, actor_id, type, post_id, message)
    VALUES (
        post_author_id,
        NEW.profile_id,
        'like',
        NEW.post_id,
        '@' || actor_username || ' liked your spark.'
    );
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_on_like ON public.likes;
CREATE TRIGGER trg_notify_on_like
    AFTER INSERT ON public.likes
    FOR EACH ROW EXECUTE FUNCTION public.notify_on_like();

-- Trigger: notify on comment
CREATE OR REPLACE FUNCTION public.notify_on_comment()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    post_author_id UUID;
    actor_username TEXT;
BEGIN
    SELECT author_id INTO post_author_id FROM public.posts WHERE id = NEW.post_id;
    IF post_author_id IS NOT DISTINCT FROM NEW.profile_id THEN
        RETURN NEW;
    END IF;
    SELECT username INTO actor_username FROM public.profiles WHERE id = NEW.profile_id;

    INSERT INTO public.notifications (recipient_id, actor_id, type, post_id, message)
    VALUES (
        post_author_id,
        NEW.profile_id,
        'comment',
        NEW.post_id,
        '@' || actor_username || ' commented on your spark.'
    );
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_on_comment ON public.comments;
CREATE TRIGGER trg_notify_on_comment
    AFTER INSERT ON public.comments
    FOR EACH ROW EXECUTE FUNCTION public.notify_on_comment();

-- Trigger: notify on follow
CREATE OR REPLACE FUNCTION public.notify_on_follow()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    actor_username TEXT;
BEGIN
    SELECT username INTO actor_username FROM public.profiles WHERE id = NEW.follower_id;

    INSERT INTO public.notifications (recipient_id, actor_id, type, message)
    VALUES (
        NEW.following_id,
        NEW.follower_id,
        'follow',
        '@' || actor_username || ' started following you.'
    );
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_on_follow ON public.follows;
CREATE TRIGGER trg_notify_on_follow
    AFTER INSERT ON public.follows
    FOR EACH ROW EXECUTE FUNCTION public.notify_on_follow();

-- Trigger: notify author when their post is approved or rejected
CREATE OR REPLACE FUNCTION public.notify_on_post_status_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    IF NEW.status = 'approved' AND OLD.status <> 'approved' THEN
        INSERT INTO public.notifications (recipient_id, type, post_id, message)
        VALUES (
            NEW.author_id,
            'post_approved',
            NEW.id,
            'Your spark was approved and is now live!'
        );
    ELSIF NEW.status = 'rejected' AND OLD.status <> 'rejected' THEN
        INSERT INTO public.notifications (recipient_id, type, post_id, message)
        VALUES (
            NEW.author_id,
            'post_rejected',
            NEW.id,
            COALESCE('Your spark was rejected: ' || NEW.rejection_reason, 'Your spark was rejected by a moderator.')
        );
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_on_post_status ON public.posts;
CREATE TRIGGER trg_notify_on_post_status
    AFTER UPDATE OF status ON public.posts
    FOR EACH ROW EXECUTE FUNCTION public.notify_on_post_status_change();

-- ---------------------------------------------------------------------------
-- 3. TABLE: public.direct_messages
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.direct_messages (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id       UUID        NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
    recipient_id    UUID        NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
    body            TEXT        NOT NULL CHECK (char_length(body) BETWEEN 1 AND 5000),
    read            BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT no_self_dm CHECK (sender_id <> recipient_id)
);

CREATE INDEX IF NOT EXISTS idx_dm_sender_id     ON public.direct_messages (sender_id);
CREATE INDEX IF NOT EXISTS idx_dm_recipient_id  ON public.direct_messages (recipient_id);
CREATE INDEX IF NOT EXISTS idx_dm_created_at    ON public.direct_messages (created_at DESC);
-- Fast conversation thread query
CREATE INDEX IF NOT EXISTS idx_dm_thread ON public.direct_messages (
    LEAST(sender_id, recipient_id),
    GREATEST(sender_id, recipient_id),
    created_at DESC
);

-- RLS
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dm_select_participant ON public.direct_messages;
CREATE POLICY dm_select_participant ON public.direct_messages
    FOR SELECT USING (
        sender_id = (public.current_profile()).id OR
        recipient_id = (public.current_profile()).id
    );

DROP POLICY IF EXISTS dm_insert_own ON public.direct_messages;
CREATE POLICY dm_insert_own ON public.direct_messages
    FOR INSERT WITH CHECK (sender_id = (public.current_profile()).id);

DROP POLICY IF EXISTS dm_update_recipient ON public.direct_messages;
CREATE POLICY dm_update_recipient ON public.direct_messages
    FOR UPDATE USING (recipient_id = (public.current_profile()).id);

-- Grants
GRANT SELECT, INSERT, UPDATE ON public.direct_messages TO authenticated;
GRANT ALL ON public.direct_messages TO service_role;

-- Enable Supabase Realtime
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
          AND schemaname = 'public' 
          AND tablename = 'direct_messages'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;
    END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 4. RPC: get_conversations(profile_id)
-- Returns the latest message per conversation partner for the inbox view.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_conversations(p_profile_id UUID)
RETURNS TABLE (
    other_profile_id    UUID,
    other_username      TEXT,
    other_display_name  TEXT,
    other_avatar_url    TEXT,
    last_message        TEXT,
    last_message_at     TIMESTAMPTZ,
    unread_count        BIGINT
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
    WITH ranked AS (
        SELECT
            CASE WHEN sender_id = p_profile_id THEN recipient_id ELSE sender_id END AS other_id,
            body,
            created_at,
            (recipient_id = p_profile_id AND read = FALSE) AS is_unread,
            ROW_NUMBER() OVER (
                PARTITION BY LEAST(sender_id, recipient_id), GREATEST(sender_id, recipient_id)
                ORDER BY created_at DESC
            ) AS rn
        FROM public.direct_messages
        WHERE sender_id = p_profile_id OR recipient_id = p_profile_id
    ),
    latest AS (
        SELECT other_id, body AS last_message, created_at AS last_message_at
        FROM ranked WHERE rn = 1
    ),
    unread AS (
        SELECT
            CASE WHEN sender_id = p_profile_id THEN recipient_id ELSE sender_id END AS other_id,
            COUNT(*) AS unread_count
        FROM public.direct_messages
        WHERE recipient_id = p_profile_id AND read = FALSE
        GROUP BY other_id
    )
    SELECT
        p.id            AS other_profile_id,
        p.username      AS other_username,
        p.display_name  AS other_display_name,
        p.avatar_url    AS other_avatar_url,
        l.last_message,
        l.last_message_at,
        COALESCE(u.unread_count, 0) AS unread_count
    FROM latest l
    JOIN public.profiles p ON p.id = l.other_id AND p.deleted_at IS NULL
    LEFT JOIN unread u ON u.other_id = l.other_id
    ORDER BY l.last_message_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_conversations(UUID) TO authenticated;
