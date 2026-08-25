-- Fix RBAC for Elite Store: ensure role check, created_at, and RLS/policies are correct.
-- Also remove the auth trigger because AdminUsers.jsx creates profiles manually.

-- 1. Ensure created_at column exists
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();

-- 2. Fix role check constraint to allow admin and seller
ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_role_check
CHECK (role IN ('admin', 'seller'));

-- 3. Remove the auth trigger that was causing signup errors
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- 4. Ensure RLS helper and policies are correct
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_select_self ON public.profiles;
DROP POLICY IF EXISTS profiles_admin_select_all ON public.profiles;
DROP POLICY IF EXISTS profiles_admin_insert ON public.profiles;
DROP POLICY IF EXISTS profiles_admin_update ON public.profiles;
DROP POLICY IF EXISTS profiles_admin_delete ON public.profiles;

CREATE POLICY profiles_select_self ON public.profiles
FOR SELECT USING (auth.uid() = id);

CREATE POLICY profiles_admin_select_all ON public.profiles
FOR SELECT USING (public.is_admin());

CREATE POLICY profiles_admin_insert ON public.profiles
FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY profiles_admin_update ON public.profiles
FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY profiles_admin_delete ON public.profiles
FOR DELETE USING (public.is_admin());
