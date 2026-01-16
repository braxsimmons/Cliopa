alter table "public"."time_off_requests" drop constraint "time_off_requests_status_check";

alter table "public"."time_off_requests" add constraint "time_off_requests_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'denied'::text, 'exception'::text]))) not valid;

alter table "public"."time_off_requests" validate constraint "time_off_requests_status_check";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.exception_time_off_request(request_id uuid, approver_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
	-- Update the request status
	UPDATE public.time_off_requests
	SET
		status = 'exception',
		approved_by = approver_id,
		approved_at = NOW(),
		updated_at = NOW()
	WHERE
		id = request_id
		AND status = 'pending'
	;

	IF NOT FOUND THEN
	RAISE EXCEPTION 'Request not found or already processed';
	END IF;

	RETURN TRUE;
	END;
$function$
;
