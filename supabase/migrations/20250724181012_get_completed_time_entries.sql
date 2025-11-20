set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.get_completed_time_entries()
 RETURNS TABLE(id uuid, start_time timestamp with time zone, end_time timestamp with time zone, team text, status text, total_hours numeric, first_name text, last_name text, email text)
 LANGUAGE sql
AS $function$
WITH start_time_cte AS (
	SELECT
		time_entry_id
		, requested_start_time
	FROM public.time_corrections
	WHERE requested_start_time is not null
	AND status = 'approved'
	ORDER BY updated_at DESC
	LIMIT 1
),
end_time_cte AS (
	SELECT
		time_entry_id
		, requested_end_time
	FROM public.time_corrections
	WHERE requested_end_time IS NOT NULL
	AND status = 'approved'
	ORDER BY updated_at DESC
	LIMIT 1
),
team_cte AS (
	SELECT
		time_entry_id
		, team
	FROM public.time_corrections
	WHERE team IS NOT NULL
	AND status = 'approved'
	ORDER BY updated_at DESC
	LIMIT 1
)
SELECT
	te.id
	, COALESCE(st.requested_start_time, te.start_time) AS start_time
	, COALESCE(et.requested_end_time, te.end_time) AS end_time
	, COALESCE(tcte.team, te.team) AS team
	, COALESCE((
		SELECT
			status
		FROM public.time_corrections AS tc
		WHERE tc.time_entry_id = te.id
		ORDER BY tc.created_at DESC
		LIMIT 1
		), te.status) AS status
	, ROUND(EXTRACT(EPOCH FROM ( COALESCE(et.requested_end_time, te.end_time) - COALESCE(st.requested_start_time, te.start_time))) / 3600.0, 2) AS total_hours
	, p.first_name
	, p.last_name
	, p.email
FROM public.time_entries AS te
LEFT JOIN start_time_cte AS st
	ON st.time_entry_id = te.id
LEFT JOIN end_time_cte AS et
	ON et.time_entry_id = te.id
LEFT JOIN team_cte AS tcte
	ON tcte.time_entry_id = te.id
INNER JOIN public.profiles AS p
	ON p.id = te.user_id
WHERE te.status != 'active'
ORDER BY start_time DESC
$function$
;
