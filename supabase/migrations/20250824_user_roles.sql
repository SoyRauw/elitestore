-- Profiles / roles support
-- Admin users created from the panel get an internal email like username@elite.local

-- Make sure the profiles table exists with the columns we need
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE,
  email text,
  name text,
  role text NOT NULL DEFAULT 'seller' CHECK (role IN ('admin', 'seller')),
  created_at timestamp with time zone DEFAULT now()
);

-- Add columns safely if the table already exists without them
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS username text,
ADD COLUMN IF NOT EXISTS role text,
ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();

-- Ensure the role check constraint is correct
ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_role_check
CHECK (role IN ('admin', 'seller'));

-- Existing users become admins (the app had no seller concept before this migration)
UPDATE public.profiles
SET role = 'admin'
WHERE role IS NULL OR role = '';

-- Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_select_self ON public.profiles;
DROP POLICY IF EXISTS profiles_admin_all ON public.profiles;

-- Helper function to avoid recursive policy checks on the same table.
-- SECURITY DEFINER lets the function read profiles regardless of RLS.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Users can always read their own profile.
CREATE POLICY profiles_select_self ON public.profiles
FOR SELECT USING (auth.uid() = id);

-- Admins can read/update/delete/insert any profile.
CREATE POLICY profiles_admin_select_all ON public.profiles
FOR SELECT USING (public.is_admin());

CREATE POLICY profiles_admin_insert ON public.profiles
FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY profiles_admin_update ON public.profiles
FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY profiles_admin_delete ON public.profiles
FOR DELETE USING (public.is_admin());
