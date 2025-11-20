CREATE FUNCTION public.update_employee_shifts_updated_at()
RETURNS trigger
    LANGUAGE plpgsql
	SET search_path = ''
AS $$
BEGIN
	NEW.updated_at = NOW();
	RETURN NEW;
END;
$$;
