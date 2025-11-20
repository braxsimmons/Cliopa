CREATE POLICY "Admins, managers, and the owner may delete time entries"
	ON public.time_entries
	FOR DELETE
	TO authenticated
	USING ((
		(SELECT auth.uid()) = user_id
		OR (SELECT public.has_any_role(ARRAY['admin'::public.app_role, 'manager'::public.app_role]))
	))
;

CREATE POLICY "Admins, managers, and the owner may create new entries"
	ON public.time_entries
	FOR INSERT
	TO authenticated
	WITH CHECK ((
		(SELECT auth.uid()) = user_id
		OR (SELECT public.has_any_role(ARRAY['admin'::public.app_role, 'manager'::public.app_role]))
	))
;

CREATE POLICY "Admins, managers, and the owner may see entries"
	ON public.time_entries
	FOR SELECT
	TO authenticated
	USING ((
		(SELECT auth.uid()) = user_id
		OR (SELECT public.has_any_role(ARRAY['admin'::public.app_role, 'manager'::public.app_role]))
	))
;

CREATE POLICY "Admins, managers, and the owner may update entries"
	ON public.time_entries
	FOR UPDATE
	TO authenticated
	USING ((
		(SELECT auth.uid()) = user_id
		OR (SELECT public.has_any_role(ARRAY['admin'::public.app_role, 'manager'::public.app_role]))
	))
;

ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;
