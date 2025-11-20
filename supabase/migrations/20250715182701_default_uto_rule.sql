drop policy "Allow delete on own requests" on "public"."time_off_requests";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
		COALESCE(NEW.raw_user_meta_data->>'role', 'ccm'),
		(SELECT id FROM uto_id)
	);

	INSERT INTO public.user_roles (
		user_id, role
	)
	VALUES (
		NEW.id,
		COALESCE(NEW.raw_user_meta_data->>'role', 'ccm')::public.app_role
	);
	RETURN NEW;
END;
$function$
;


