CREATE FUNCTION public.auto_end_shift(
	user_id_param uuid
	, time_entry_id_param uuid
) RETURNS boolean
    LANGUAGE plpgsql
	SET search_path = ''
	SECURITY DEFINER
    AS $$
DECLARE
	shift_record RECORD;
	end_time TIMESTAMP WITH TIME ZONE;
BEGIN
	-- Get the time entry and calculate end time based on schedule
	SELECT
		te.start_time
		, es.morning_end
		, es.afternoon_end
	INTO shift_record
	FROM
		time_entries AS te
		LEFT JOIN employee_shifts AS es
			ON es.user_id = te.user_id
				AND es.day_of_week = EXTRACT(DOW FROM te.start_time)
	WHERE
		te.id = time_entry_id_param
		AND te.user_id = user_id_param
		AND te.status = 'active'
	;

	IF NOT FOUND THEN
	RETURN FALSE;
	END IF;

	-- Determine if this is morning or afternoon shift and set appropriate end time
	IF EXTRACT(HOUR FROM shift_record.start_time) < 12 THEN
		-- Morning shift
		end_time := DATE_TRUNC('day', shift_record.start_time) + shift_record.morning_end;
	ELSE
		-- Afternoon shift
		end_time := DATE_TRUNC('day', shift_record.start_time) + shift_record.afternoon_end;
	END IF;

	-- Update the time entry
	UPDATE time_entries
	SET
		end_time = end_time,
		total_hours = EXTRACT(EPOCH FROM (end_time - start_time)) / 3600.0,
		status = 'auto_ended',
		updated_at = now()
	WHERE
		id = time_entry_id_param
	;

	RETURN TRUE;
	END;
$$;
