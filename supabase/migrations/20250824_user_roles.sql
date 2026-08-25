-- Profiles / roles support
-- Admin users created from the panel get an internal email like username@elite.local

-- Make sure the profiles table exists with the columns we need
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE,
  email text,
  name text,
  role text NOT NULL DEFAULT 'seller'
);

-- Add columns safely if the table already exists without them
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS username text,
ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'seller';

-- Existing users become admins (the app had no seller concept before this migration)
UPDATE public.profiles
SET role = 'admin'
WHERE role = 'seller' OR role IS NULL OR role = '';

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

-- Trigger: create a profile row automatically when a new auth.users row is inserted.
-- The frontend sends the desired username/role inside user_metadata when signing up.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, email, name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'seller')
  )
  ON CONFLICT (id) DO UPDATE SET
    username = COALESCE(EXCLUDED.username, public.profiles.username),
    email = EXCLUDED.email,
    name = COALESCE(EXCLUDED.name, public.profiles.name),
    role = COALESCE(public.profiles.role, EXCLUDED.role);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
