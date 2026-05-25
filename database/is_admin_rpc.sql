-- =============================================================================
-- SPARK APP — is_admin() RPC Hook
-- Migration File: Creates the public.is_admin() RPC function
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
