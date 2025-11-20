CREATE FUNCTION public.handle_new_user()
RETURNS trigger
    LANGUAGE plpgsql
	SET search_path = ''
	SECURITY DEFINER
    AS $$
BEGIN
	WITH uto_id AS (
	SELECT
		ID
	FROM
		public.time_off_rules
	WHERE
		name = 'UTO'
	)
	INSERT INTO public.profiles (
		id, email, first_name, last_name, role, uto_rule
	)
	VALUES (
		NEW.id,
		NEW.email,
		COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
		COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
		COALESCE(NEW.raw_user_meta_data->>'role', 'ccm')::public.app_role,
		(SELECT id FROM uto_id)
	);

	RETURN NEW;
END;
$$;
