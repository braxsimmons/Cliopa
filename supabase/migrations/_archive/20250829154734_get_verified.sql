drop function if exists "public"."get_completed_time_entries"();

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.get_completed_time_entries()
 RETURNS TABLE(id uuid, start_time timestamp with time zone, end_time timestamp with time zone, team text, status text, total_hours numeric, first_name text, last_name text, email text, verified timestamp with time zone)
 LANGUAGE sql
AS $function$
WITH base_data AS (
	SELECT
	te.user_id
	, te.id
	, te.status
	, COALESCE((
		SELECT tc2.requested_start_time
		FROM public.time_corrections tc2
		WHERE tc2.time_entry_id = te.id
			AND tc2.status = 'approved'
			AND tc2.requested_start_time IS NOT NULL
		ORDER BY tc2.approved_at DESC
		LIMIT 1
	), te.start_time) AS current_start_time
	, COALESCE((
		SELECT tc2.requested_end_time
		FROM public.time_corrections tc2
		WHERE tc2.time_entry_id = te.id
			AND tc2.status = 'approved'
			AND tc2.requested_end_time IS NOT NULL
		ORDER BY tc2.approved_at DESC
		LIMIT 1
	), te.end_time) AS current_end_time
	, COALESCE((
		SELECT tc2.team
		FROM public.time_corrections tc2
		WHERE tc2.time_entry_id = te.id
			AND tc2.status = 'approved'
			AND tc2.team IS NOT NULL
		ORDER BY tc2.approved_at DESC
		LIMIT 1
	), te.team) AS current_team
	, p.first_name
	, p.last_name
	, p.email
	, te.verified
FROM public.time_entries te
LEFT JOIN public.profiles p
	ON p.id = te.user_id
WHERE te.status != 'active'
)
SELECT
	id
	, current_start_time AS start_time
	, current_end_time AS end_time
	, current_team AS team
	, status
	, ROUND(EXTRACT(EPOCH FROM ( current_end_time - current_start_time)) / 3600.0, 2) AS total_hours
	, first_name
	, last_name
	, email
	, verified
FROM base_data
ORDER BY current_start_time DESC;
$function$
;


