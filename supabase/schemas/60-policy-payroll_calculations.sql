CREATE POLICY "Admins can manage payroll calculations"
	ON public.payroll_calculations
	FOR ALL
	TO authenticated
	USING ((SELECT public.has_any_role(ARRAY['admin'::public.app_role])))
;

ALTER TABLE public.payroll_calculations ENABLE ROW LEVEL SECURITY;
