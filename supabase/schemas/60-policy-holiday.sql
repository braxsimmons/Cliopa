CREATE POLICY "Admins can manage holidays"
	ON public.holidays
	TO authenticated
	USING ((SELECT public.has_any_role(ARRAY['admin'::public.app_role])))
;

ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;
