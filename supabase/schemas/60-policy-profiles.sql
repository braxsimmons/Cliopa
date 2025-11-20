CREATE POLICY "Admins may delete any profile"
	ON public.profiles
	FOR DELETE
	TO authenticated
	USING ((SELECT public.has_role('admin'::public.app_role)))
;

CREATE POLICY "Admins or the owner may create a profile"
	ON public.profiles
	FOR INSERT
	TO authenticated
	WITH CHECK ((
		(SELECT auth.uid()) = public.profiles.id
		OR (SELECT public.has_role('admin'::public.app_role))
	))
;

CREATE POLICY "Users with role may view a profile"
	ON public.profiles
	FOR SELECT
	TO authenticated
	USING ((SELECT auth.uid()) = public.profiles.id
	OR (SELECT public.has_any_role(ARRAY['admin'::public.app_role, 'manager'::public.app_role, 'ccm'::public.app_role, 'crm'::public.app_role])))
;

CREATE POLICY "Admins or the owner may update a profile"
	ON public.profiles
	FOR UPDATE
	TO authenticated
	USING ((
		(SELECT auth.uid()) = public.profiles.id
		OR (SELECT public.has_role('admin'::public.app_role))
	))
;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
