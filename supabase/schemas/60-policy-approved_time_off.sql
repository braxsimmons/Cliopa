CREATE POLICY "Admins and managers or the owner can view approved time off"
	ON public.approved_time_off
	FOR SELECT
	TO authenticated
	USING ((
		(SELECT auth.uid()) = user_id
		OR (SELECT public.has_any_role(ARRAY['admin'::public.app_role, 'manager'::public.app_role]))
	))
;

CREATE POLICY "Only admins and managers can insert approved time off"
	ON public.approved_time_off
	FOR INSERT
	TO authenticated
	WITH CHECK ((SELECT public.has_any_role(ARRAY['admin'::public.app_role, 'manager'::public.app_role])))
;

CREATE POLICY "Users can view their own approved time off"
	ON public.approved_time_off
	FOR SELECT
	TO authenticated
	USING (((SELECT auth.uid()) = user_id))
;
ALTER TABLE public.approved_time_off ENABLE ROW LEVEL SECURITY;
