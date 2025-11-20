CREATE FUNCTION public.get_user_roles(
	target_user_id uuid DEFAULT auth.uid()
) RETURNS public.app_role[]
    LANGUAGE sql
	SET search_path = ''
	STABLE
	SECURITY DEFINER
AS $$
	SELECT ARRAY_AGG(role)
	FROM public.profiles
	WHERE id = target_user_id;
$$;
