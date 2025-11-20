CREATE FUNCTION public.exception_time_off_request(
	request_id uuid
	, approver_id uuid
) RETURNS boolean
    LANGUAGE plpgsql
	SET search_path = ''
	SECURITY DEFINER
    AS $$
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
$$;
