CREATE POLICY "Admins can manage pay periods"
	ON public.pay_periods
	FOR ALL
	TO authenticated
	USING ((SELECT public.has_any_role(ARRAY['admin'::public.app_role])))
;

ALTER TABLE public.pay_periods ENABLE ROW LEVEL SECURITY;
