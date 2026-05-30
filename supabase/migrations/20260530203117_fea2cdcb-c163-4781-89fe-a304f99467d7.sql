
-- 1. Attach the handle_new_user trigger to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. Backfill profiles for any existing user that lacks one
INSERT INTO public.profiles (user_id, display_name, preferred_language)
SELECT u.id,
       COALESCE(u.raw_user_meta_data ->> 'display_name',
                u.raw_user_meta_data ->> 'full_name',
                split_part(u.email, '@', 1)),
       COALESCE(u.raw_user_meta_data ->> 'preferred_language', 'en')
FROM auth.users u
LEFT JOIN public.profiles p ON p.user_id = u.id
WHERE p.user_id IS NULL;

-- 3. Backfill default 'user' role for any user without any role
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'user'::app_role
FROM auth.users u
LEFT JOIN public.user_roles ur ON ur.user_id = u.id
WHERE ur.user_id IS NULL;

-- 4. Promote the project owner to admin
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role
FROM auth.users
WHERE email = 'aabdelwahab498@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;
