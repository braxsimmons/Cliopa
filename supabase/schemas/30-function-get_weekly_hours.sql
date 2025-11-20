CREATE FUNCTION public.get_weekly_hours(
	target_user_id uuid
) RETURNS TABLE(
	week_start_date date,
	monday_hours numeric,
	tuesday_hours numeric,
	wednesday_hours numeric,
	thursday_hours numeric,
	friday_hours numeric,
	total_week_hours numeric,
	all_verified bool,
	unverified_ids uuid[],
	verified_ids uuid[],
	has_pending_entries bool
) AS $$
WITH base_data AS (
	SELECT
		te.user_id,
		te.id,
		COALESCE((
			SELECT status
			FROM public.time_corrections AS tc
			WHERE tc.time_entry_id = te.id
			ORDER BY tc.created_at DESC
			LIMIT 1
		), te.status) AS status,
		COALESCE((
			SELECT tc.requested_start_time
			FROM public.time_corrections tc
			WHERE tc.requested_start_time IS NOT NULL
				AND tc.status != 'denied'
				AND tc.time_entry_id = te.id
				AND tc.user_id = target_user_id
			ORDER BY tc.updated_at DESC
			LIMIT 1
		), te.start_time) AS current_start_time,
		COALESCE((
			SELECT tc.requested_end_time
			FROM public.time_corrections tc
			WHERE tc.requested_end_time IS NOT NULL
				AND tc.status != 'denied'
				AND tc.time_entry_id = te.id
				AND tc.user_id = target_user_id
			ORDER BY tc.updated_at DESC
			LIMIT 1
		), te.end_time) AS current_end_time,
		COALESCE((
			SELECT tc.team
			FROM public.time_corrections tc
			WHERE tc.team IS NOT NULL
				AND tc.status != 'denied'
				AND tc.time_entry_id = te.id
				AND tc.user_id = target_user_id
			ORDER BY tc.updated_at DESC
			LIMIT 1
		), te.team) AS current_team,
		COALESCE((
			SELECT tc.shift_type
			FROM public.time_corrections tc
			WHERE tc.shift_type IS NOT NULL
				AND tc.status != 'denied'
				AND tc.time_entry_id = te.id
				AND tc.user_id = target_user_id
			ORDER BY tc.updated_at DESC
			LIMIT 1
		), te.shift_type) AS current_shift_type,
		te.verified
	FROM public.time_entries te
	WHERE te.user_id = target_user_id
		AND te.status != 'active'
),
enriched_data AS (
	SELECT
		id,
		current_start_time,
		current_end_time,
		current_team,
		current_shift_type,
		status,
		verified,
		ROUND(EXTRACT(EPOCH FROM (current_end_time - current_start_time)) / 3600.0, 2) AS hours,
		DATE_TRUNC('week', current_start_time)::date AS week_start,
		EXTRACT(ISODOW FROM current_start_time) AS day_of_week
	FROM base_data
)
SELECT
	week_start AS week_start_date,
	COALESCE(SUM(hours) FILTER (WHERE day_of_week = 1), 0) AS monday_hours,
	COALESCE(SUM(hours) FILTER (WHERE day_of_week = 2), 0) AS tuesday_hours,
	COALESCE(SUM(hours) FILTER (WHERE day_of_week = 3), 0) AS wednesday_hours,
	COALESCE(SUM(hours) FILTER (WHERE day_of_week = 4), 0) AS thursday_hours,
	COALESCE(SUM(hours) FILTER (WHERE day_of_week = 5), 0) AS friday_hours,
	COALESCE(SUM(hours) FILTER (WHERE day_of_week BETWEEN 1 AND 5), 0) AS total_week_hours,
	BOOL_AND(verified IS NOT NULL) AS all_verified,
	ARRAY_AGG(id) FILTER (WHERE verified IS NULL) AS unverified_ids,
	ARRAY_AGG(id) FILTER (WHERE verified IS NOT NULL) AS verified_ids,
	BOOL_OR(status = 'pending') AS has_pending_entries
FROM enriched_data
WHERE day_of_week BETWEEN 1 AND 5  -- Only Monday through Friday
GROUP BY week_start
ORDER BY week_start DESC
$$ LANGUAGE sql
;
