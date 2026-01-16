set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.get_all_time_corrections_user(target_user_id uuid)
 RETURNS TABLE(original_start_time timestamp with time zone, original_end_time timestamp with time zone, original_team text, requested_start_time timestamp with time zone, requested_end_time timestamp with time zone, requested_team text, status text, reason text, approved_at timestamp with time zone, approved_by text, created_at timestamp with time zone)
 LANGUAGE sql
AS $function$
WITH tc_cte AS (
	SELECT
		requested_start_time
		, requested_end_time
		, team AS requested_team
		, review_notes
		, status
		, reason
		, approved_at
		, approved_by
		, created_at
		, time_entry_id
	FROM public.time_corrections
	WHERE user_id = target_user_id
)
SELECT
	te.start_time AS original_start_time
	, te.end_time AS original_end_time
	, te.team AS original_team
	, tc.requested_start_time
	, tc.requested_end_time
	, tc.requested_team
	, tc.status
	, tc.reason
	, tc.approved_at
	, (p.first_name || ' ' || p.last_name) AS approved_by
	, tc.created_at
FROM public.time_entries AS te
INNER JOIN tc_cte AS tc
	ON te.id = tc.time_entry_id
LEFT JOIN public.profiles AS p
	on p.id = tc.approved_by
ORDER BY created_at DESC
$function$
;
