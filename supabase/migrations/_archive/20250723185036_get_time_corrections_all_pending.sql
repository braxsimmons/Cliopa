set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.get_time_corrections_all_pending()
 RETURNS TABLE(original_start_time timestamp with time zone, original_end_time timestamp with time zone, original_team text, requested_start_time timestamp with time zone, requested_end_time timestamp with time zone, requested_team text, current_start_time timestamp with time zone, current_end_time timestamp with time zone, current_team text, status text, reason text, created_at timestamp with time zone)
 LANGUAGE sql
AS $function$
WITH tc_cte AS (
	SELECT
		requested_start_time,
		requested_end_time,
		team AS requested_team,
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
	, tc.requested_start_time
	, tc.requested_end_time
	, tc.requested_team
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
	, tc.status
	, tc.reason
	, tc.created_at
FROM public.time_entries te
JOIN tc_cte tc
	ON te.id = tc.time_entry_id
ORDER BY tc.created_at DESC;
$function$
;
