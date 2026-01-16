set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.get_time_off_data(target_user_id uuid, requested_start_date timestamp with time zone, requested_end_date timestamp with time zone, rule_id uuid)
 RETURNS TABLE(period text, days_requested_in_period numeric, request_start timestamp with time zone, request_end timestamp with time zone, total_for_period numeric, current_available numeric, current_pending numeric)
 LANGUAGE sql
AS $function$
WITH time_off_rule AS (
	SELECT
		id
		, name
		, value
		, reset_period
		, reset_unit
		, not_before
		, not_before_unit
	FROM time_off_rules AS tor
	WHERE tor.id = rule_id
)
,	all_periods AS (
    SELECT
        pc.id AS profile_id
        , g.period_start
        , LEAD(g.period_start) OVER (
            PARTITION BY pc.id
            ORDER BY g.period_start
        ) - INTERVAL '1 day' AS period_end
        , pto.value AS total_amount
    FROM profiles pc
    INNER JOIN time_off_rule pto
        ON pto.id = pc.pto_rule
    INNER JOIN generate_series(0, 250) AS gs(n) ON true
    CROSS JOIN LATERAL (
        SELECT pc.start_date + (
            gs.n * (pto.reset_period || ' ' || lower(pto.reset_unit::text))::interval
        ) AS period_start
    ) g
    WHERE pc.id = target_user_id
)
, filtered_periods AS (
    SELECT *
    FROM all_periods
    WHERE period_start <= requested_end_date
      AND (period_end >= requested_start_date OR period_start >= requested_start_date)
)
SELECT
    TO_CHAR(pp.period_start, 'YYYY/MM/DD') || '-' || TO_CHAR(pp.period_end, 'YYYY/MM/DD') AS period
	, LEAST(requested_end_date::date, pp.period_end)::date
	- GREATEST(requested_start_date::date, pp.period_start)::date + 1 AS days_requested_in_period
	, GREATEST(requested_start_date::date, pp.period_start) AS request_start
	, LEAST(requested_end_date::date, pp.period_end) AS request_end
	, pp.total_amount AS total_for_period
    , pp.total_amount
        - COALESCE(SUM(CASE WHEN r.status = 'approved' THEN r.days_requested ELSE 0 END), 0)
        - COALESCE(SUM(CASE WHEN r.status = 'pending' THEN r.days_requested ELSE 0 END), 0) AS current_available
    , COALESCE(SUM(CASE WHEN r.status = 'pending' THEN r.days_requested ELSE 0 END), 0) AS current_pending
FROM filtered_periods pp
LEFT JOIN time_off_requests r
    ON r.user_id = pp.profile_id
    AND r.start_date BETWEEN pp.period_start AND pp.period_end
GROUP BY pp.profile_id, pp.period_start, pp.period_end, pp.total_amount
ORDER BY pp.profile_id, pp.period_start
$function$
;
