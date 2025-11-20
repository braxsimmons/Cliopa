CREATE POLICY "Users can create their own early clock attempts"
	ON public.early_clock_attempts
	FOR INSERT
	TO authenticated
	WITH CHECK (((SELECT auth.uid()) = user_id))
;

CREATE POLICY "Users can update their own early clock attempts"
	ON public.early_clock_attempts
	FOR UPDATE
	TO authenticated
	USING (((SELECT auth.uid()) = user_id))
;

CREATE POLICY "Users can view their own early clock attempts"
	ON public.early_clock_attempts
	FOR SELECT
	TO authenticated
	USING (((SELECT auth.uid()) = user_id))
;

ALTER TABLE public.early_clock_attempts ENABLE ROW LEVEL SECURITY;
