alter table "public"."time_corrections" drop column "approval_notes";

alter table "public"."time_corrections" add column "review_notes" text;

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
		updated_at = NOW(),
		review_notes = notes
	WHERE
		id = correction_id
	;

	RETURN TRUE;
END;
$function$
;


CREATE OR REPLACE FUNCTION public.approve_time_correction(correction_id uuid, approver_id uuid, notes text DEFAULT NULL::text)
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

	-- Update the time entry with the corrected end time
	UPDATE public.time_entries
	SET
		end_time = correction_record.requested_end_time,
		total_hours = EXTRACT(EPOCH FROM (correction_record.requested_end_time - start_time)) / 3600.0,
		status = 'completed',
		updated_at = NOW()
	WHERE
		id = correction_record.time_entry_id
	;

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
$function$
;
