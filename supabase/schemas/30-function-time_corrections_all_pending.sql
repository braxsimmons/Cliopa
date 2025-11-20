CREATE FUNCTION public.get_time_corrections_all_pending(
) RETURNS TABLE(
	original_start_time timestamptz
	, original_end_time timestamptz
	, original_team text
	, original_shift_type text
	, requested_start_time timestamptz
	, requested_end_time timestamptz
	, requested_team text
	, requested_shift_type text
	, current_start_time timestamptz
	, current_end_time timestamptz
	, current_team text
	, current_shift_type text
	, status text
	, reason text
	, created_at timestamptz
	, first_name text
	, last_name text
	, email text
	, id uuid
) AS $$
WITH tc_cte AS (
	SELECT
		requested_start_time,
		requested_end_time,
		team AS requested_team,
		shift_type AS requested_shift_type,
		status,
		reason,
		created_at,
		time_entry_id,
		id
	FROM public.time_corrections
	WHERE status = 'pending'
)
SELECT
	te.start_time AS original_start_time
	,te.end_time AS original_end_time
	,te.team AS original_team
	, te.shift_type AS original_shift_type
	, tc.requested_start_time
	, tc.requested_end_time
	, tc.requested_team
	, tc.requested_shift_type
	, COALESCE((
		SELECT tc2.requested_start_time
		FROM public.time_corrections tc2
		WHERE tc2.time_entry_id = tc.time_entry_id
			AND tc2.created_at < tc.created_at
			AND tc2.status = 'approved'
			AND tc2.requested_start_time IS NOT NULL
		ORDER BY tc2.created_at DESC
		LIMIT 1
	), te.start_time) AS current_start_time
	, COALESCE((
		SELECT tc2.requested_end_time
		FROM public.time_corrections tc2
		WHERE tc2.time_entry_id = tc.time_entry_id
			AND tc2.created_at < tc.created_at
			AND tc2.status = 'approved'
			AND tc2.requested_end_time IS NOT NULL
		ORDER BY tc2.created_at DESC
		LIMIT 1
	), te.end_time) AS current_end_time
	, COALESCE((
		SELECT tc2.team
		FROM public.time_corrections tc2
		WHERE tc2.time_entry_id = tc.time_entry_id
			AND tc2.created_at < tc.created_at
			AND tc2.status = 'approved'
			AND tc2.team IS NOT NULL
		ORDER BY tc2.created_at DESC
		LIMIT 1
	), te.team) AS current_team
	, COALESCE((
		SELECT tc2.shift_type
		FROM public.time_corrections tc2
		WHERE tc2.time_entry_id = tc.time_entry_id
			AND tc2.created_at < tc.created_at
			AND tc2.status = 'approved'
			AND tc2.shift_type IS NOT NULL
		ORDER BY tc2.created_at DESC
		LIMIT 1
	), te.shift_type) AS current_shift_type
	, tc.status
	, tc.reason
	, tc.created_at
	, p.first_name
	, p.last_name
	, p.email
	, tc.id
FROM public.time_entries te
JOIN tc_cte tc
	ON te.id = tc.time_entry_id
LEFT JOIN public.profiles p
	ON p.id = te.user_id
ORDER BY tc.created_at DESC;
$$ LANGUAGE sql
;
