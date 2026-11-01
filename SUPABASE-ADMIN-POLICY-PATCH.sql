-- REQUIRED PATCH: allow an authenticated user to check only their own admin role.
-- Safe to run once; the policy is dropped first to avoid duplicate-name errors.
DROP POLICY IF EXISTS "Admins can read their own admin role" ON public.admin_users;
CREATE POLICY "Admins can read their own admin role"
ON public.admin_users FOR SELECT TO authenticated
USING ((SELECT auth.uid()) = user_id);
