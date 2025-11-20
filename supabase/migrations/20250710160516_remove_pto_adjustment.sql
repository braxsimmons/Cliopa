set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.approve_time_off_request(request_id uuid, approver_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
	request_record RECORD;
	user_profile RECORD;
BEGIN
	-- Get the request details
	SELECT
		user_id
		, start_date
		, end_date
		, days_requested
		, request_type
	INTO request_record
	FROM public.time_off_requests
	WHERE
		id = request_id
		AND status = 'pending'
	;

	IF NOT FOUND THEN
	RAISE EXCEPTION 'Request not found or already processed';
	END IF;

	-- Get user profile for hourly rate
	SELECT
		hourly_rate
	INTO user_profile
	FROM public.profiles
	WHERE
		id = request_record.user_id
	;

	-- Update the request status
	UPDATE public.time_off_requests
	SET
		status = 'approved',
		approved_by = approver_id,
		approved_at = NOW(),
		updated_at = NOW()
	WHERE
		id = request_id
	;

	-- Create approved time off record
	INSERT INTO public.approved_time_off (
		user_id,
		request_id,
		start_date,
		end_date,
		days_taken,
		request_type,
		hourly_rate
	) VALUES (
		request_record.user_id,
		request_id,
		request_record.start_date,
		request_record.end_date,
		request_record.days_requested,
		request_record.request_type,
		user_profile.hourly_rate
	);

	RETURN TRUE;
END;
$function$
;


