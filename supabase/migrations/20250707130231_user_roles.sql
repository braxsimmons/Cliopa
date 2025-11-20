alter table "public"."profiles" drop constraint "profiles_role_check";

alter table "public"."profiles" alter column "role" set default 'ccm'::text;

alter table "public"."profiles" add constraint "profiles_role_check" CHECK ((role = ANY (ARRAY['ccm'::text, 'crm'::text, 'manager'::text, 'admin'::text]))) not valid;

alter table "public"."profiles" validate constraint "profiles_role_check";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
	INSERT INTO public.profiles (
		id, email, first_name, last_name, role
	)
	VALUES (
		NEW.id,
		NEW.email,
		COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
		COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
		COALESCE(NEW.raw_user_meta_data->>'role', 'ccm')
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