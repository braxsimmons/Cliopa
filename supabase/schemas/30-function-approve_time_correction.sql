CREATE FUNCTION public.approve_time_correction(
	correction_id UUID
	, approver_id UUID
	, notes TEXT DEFAULT NULL::TEXT
) RETURNS boolean
    LANGUAGE plpgsql
	SET search_path = ''
	SECURITY DEFINER
AS $$
DECLARE
	correction_record RECORD;
BEGIN
	-- Get the correction details
	SELECT *
	INTO correction_record
	FROM public.time_corrections
	WHERE
		id = correction_id
		AND status = 'pending'
	;

	IF NOT FOUND THEN
	RAISE EXCEPTION 'Correction not found or already processed';
	END IF;

	-- Update the correction status
	UPDATE public.time_corrections
	SET
		status = 'approved',
		approved_by = approver_id,
		approved_at = NOW(),
		review_notes = notes,
		updated_at = NOW()
	WHERE
		id = correction_id
	;

	RETURN TRUE;
END;
$$;
