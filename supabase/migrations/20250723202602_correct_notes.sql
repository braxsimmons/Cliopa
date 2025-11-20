set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.deny_time_correction(correction_id uuid, notes text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
		status = 'denied',
		review_notes = notes,
		updated_at = NOW()
	WHERE
		id = correction_id
	;

	RETURN TRUE;
END;
$function$
;


