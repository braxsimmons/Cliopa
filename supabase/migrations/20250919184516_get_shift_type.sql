drop function if exists "public"."get_completed_time_entries"();

drop function if exists "public"."get_recent_shifts"(target_user_id uuid, num_shifts numeric);

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.get_completed_time_entries()
 RETURNS TABLE(id uuid, start_time timestamp with time zone, end_time timestamp with time zone, team text, shift_type text, status text, total_hours numeric, first_name text, last_name text, email text, verified timestamp with time zone)
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
	, COALESCE((
		SELECT tc2.shift_type
		FROM public.time_corrections tc2
		WHERE tc2.time_entry_id = te.id
			AND tc2.status = 'approved'
			AND tc2.shift_type IS NOT NULL
		ORDER BY tc2.approved_at DESC
		LIMIT 1
	), te.shift_type) AS current_shift_type
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
	, current_shift_type AS shift_type
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

CREATE OR REPLACE FUNCTION public.get_recent_shifts(target_user_id uuid, num_shifts numeric)
 RETURNS TABLE(id uuid, start_time timestamp with time zone, end_time timestamp with time zone, team text, shift_type text, status text, total_hours numeric, verified timestamp with time zone)
 LANGUAGE sql
AS $function$
WITH base_data AS (
	SELECT
	te.user_id
	, te.id
	, COALESCE((
		SELECT
			status
		FROM public.time_corrections AS tc
		WHERE tc.time_entry_id = te.id
		ORDER BY tc.created_at DESC
		LIMIT 1
		), te.status) AS status
	, COALESCE((
		SELECT
		tc.requested_start_time
		FROM public.time_corrections tc
		WHERE tc.requested_start_time is not null
		AND tc.status != 'denied'
		AND tc.time_entry_id = te.id
		AND tc.user_id = target_user_id
		ORDER BY tc.updated_at DESC
		LIMIT 1
	), te.start_time) AS current_start_time
	, COALESCE((
		SELECT
		tc.requested_end_time
		FROM public.time_corrections tc
		WHERE tc.requested_end_time IS NOT NULL
		AND tc.status != 'denied'
		AND tc.time_entry_id = te.id
		AND tc.user_id = target_user_id
		ORDER BY tc.updated_at DESC
		LIMIT 1
	), te.end_time) AS current_end_time
	, COALESCE((
		SELECT
		tc.team
		FROM public.time_corrections tc
		WHERE tc.team IS NOT NULL
		AND tc.status != 'denied'
		AND tc.time_entry_id = te.id
		AND tc.user_id = target_user_id
		ORDER BY tc.updated_at DESC
		LIMIT 1
	), te.team) AS current_team
	, COALESCE((
		SELECT
		tc.shift_type
		FROM public.time_corrections tc
		WHERE tc.shift_type IS NOT NULL
		AND tc.status != 'denied'
		AND tc.time_entry_id = te.id
		AND tc.user_id = target_user_id
		ORDER BY tc.updated_at DESC
		LIMIT 1
	), te.shift_type) AS current_shift_type
	, te.verified
FROM public.time_entries te
)
SELECT
	id
	, current_start_time AS start_time
	, current_end_time AS end_time
	, current_team AS team
	, current_shift_type AS shift_type
	, status
	, ROUND(EXTRACT(EPOCH FROM ( current_end_time - current_start_time)) / 3600.0, 2) AS total_hours
	, verified
FROM base_data
WHERE user_id = target_user_id
	AND status != 'active'
ORDER BY start_time DESC
LIMIT num_shifts
$function$
;


