set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.get_user_roles(target_user_id uuid DEFAULT auth.uid())
 RETURNS app_role[]
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
	SELECT ARRAY_AGG(role)
	FROM public.profiles
	WHERE id = target_user_id;
$function$
;

CREATE OR REPLACE FUNCTION public.has_any_role(target_roles app_role[], target_user_id uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
	SELECT EXISTS (
		SELECT 1
		FROM public.profiles
		WHERE
			id = target_user_id
			AND role = ANY(target_roles)
	);
$function$
;

CREATE OR REPLACE FUNCTION public.has_role(target_role app_role, target_user_id uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
	SELECT EXISTS (
		SELECT 1
		FROM public.profiles
		WHERE
			id = target_user_id
			AND role = target_role
	);
$function$
;


