CREATE POLICY "Admins and managers or the owner can view time corrections"
	ON public.time_corrections
	FOR SELECT
	TO authenticated
	USING ((
			(SELECT public.has_any_role(ARRAY['admin'::public.app_role, 'manager'::public.app_role]))
			OR (SELECT auth.uid()) = user_id
	))
;

CREATE POLICY "Admins and managers can update time corrections"
	ON public.time_corrections
	FOR UPDATE
	TO authenticated
	USING ((SELECT public.has_any_role(ARRAY['admin'::public.app_role, 'manager'::public.app_role])))
;

CREATE POLICY "Users can create their own time corrections"
	ON public.time_corrections
	FOR INSERT
	TO authenticated
	WITH CHECK (((SELECT auth.uid()) = user_id))
;

ALTER TABLE public.time_off_requests ENABLE ROW LEVEL SECURITY;
