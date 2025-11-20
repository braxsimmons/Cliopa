CREATE POLICY "Admins can delete employee shifts"
	ON public.employee_shifts
	FOR DELETE
	TO authenticated
	USING (((SELECT public.has_any_role(ARRAY['admin'::public.app_role]))))
;

CREATE POLICY "Admins can insert employee shifts"
	ON public.employee_shifts
	FOR INSERT
	TO authenticated
	WITH CHECK (((SELECT public.has_any_role(ARRAY['admin'::public.app_role]))))
;

CREATE POLICY "Admins can update employee shifts"
	ON public.employee_shifts
	FOR UPDATE
	TO authenticated
	USING (((SELECT public.has_any_role(ARRAY['admin'::public.app_role]))))
;

CREATE POLICY "Users can view all employee shifts"
	ON public.employee_shifts
	FOR SELECT
	TO authenticated
	USING (true)
;

ALTER TABLE public.employee_shifts ENABLE ROW LEVEL SECURITY;
