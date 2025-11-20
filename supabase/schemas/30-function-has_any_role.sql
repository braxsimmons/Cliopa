CREATE FUNCTION public.has_any_role(
	target_roles public.app_role[]
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
			AND role = ANY(target_roles)
	);
$$;
