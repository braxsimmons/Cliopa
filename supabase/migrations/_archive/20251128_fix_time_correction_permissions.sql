-- Fix permissions for time correction functions
-- The deny_time_correction function was missing grants

-- Grant execute permissions on deny_time_correction
GRANT EXECUTE ON FUNCTION public.deny_time_correction(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.deny_time_correction(uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION public.deny_time_correction(uuid, text) TO service_role;

-- Ensure approve_time_correction also has grants (in case they were lost)
GRANT EXECUTE ON FUNCTION public.approve_time_correction(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_time_correction(uuid, uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION public.approve_time_correction(uuid, uuid, text) TO service_role;

-- Update approve_time_correction to also update the time_entries table
CREATE OR REPLACE FUNCTION public.approve_time_correction(
    correction_id uuid,
    approver_id uuid,
    notes text DEFAULT NULL::text
)
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
        AND status = 'pending';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Correction not found or already processed';
    END IF;

    -- Update the time entry with corrected values
    UPDATE public.time_entries
    SET
        start_time = COALESCE(correction_record.requested_start_time, start_time),
        end_time = COALESCE(correction_record.requested_end_time, end_time),
        shift_type = COALESCE(correction_record.shift_type, shift_type),
        total_hours = EXTRACT(EPOCH FROM (
            COALESCE(correction_record.requested_end_time, end_time) -
            COALESCE(correction_record.requested_start_time, start_time)
        )) / 3600,
        updated_at = NOW()
    WHERE
        id = correction_record.time_entry_id;

    -- Update the correction status
    UPDATE public.time_corrections
    SET
        status = 'approved',
        approved_by = approver_id,
        approved_at = NOW(),
        review_notes = notes,
        updated_at = NOW()
    WHERE
        id = correction_id;

    RETURN TRUE;
END;
$function$;
