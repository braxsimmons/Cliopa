CREATE POLICY "User can view all time off requests"
	ON public.time_off_requests
	FOR SELECT
	TO authenticated
	USING (true)
;

CREATE POLICY "Admins and user can update time off requests"
	ON public.time_off_requests
	FOR UPDATE
	TO authenticated
	USING ((
		(SELECT public.has_any_role(ARRAY['admin'::public.app_role]))
		OR ((SELECT auth.uid()) = time_off_requests.user_id AND time_off_requests.status = 'pending'::text)
	))
;

CREATE POLICY "Users can create their own time off requests"
	ON public.time_off_requests
	FOR INSERT
	TO authenticated
	WITH CHECK (((SELECT auth.uid()) = user_id))
;

CREATE POLICY "Users can delete their own time off requests"
	ON public.time_off_requests
	FOR DELETE
	TO authenticated
	USING ((
		(SELECT auth.uid()) = user_id
	))
;

ALTER TABLE public.time_off_requests ENABLE ROW LEVEL SECURITY;
