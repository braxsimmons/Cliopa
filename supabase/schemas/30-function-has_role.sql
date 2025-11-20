CREATE FUNCTION public.has_role(
	target_role public.app_role
	, target_user_id uuid DEFAULT auth.uid()
) RETURNS boolean
    LANGUAGE sql
	SET search_path = ''
	STABLE
	SECURITY DEFINER
AS $$
	SELECT EXISTS (
		SELECT 1
		FROM public.profiles
		WHERE
			id = target_user_id
			AND role = target_role
	);
$$;
