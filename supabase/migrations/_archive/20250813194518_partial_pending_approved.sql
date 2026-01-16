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
, all_periods AS (
    SELECT
		pc.id AS profile_id
		, g.period_start::date
		, (LEAD(g.period_start) OVER (
            PARTITION BY pc.id
            ORDER BY g.period_start
        ) - INTERVAL '1 day')::date AS period_end
		, tor.value AS total_amount
    FROM profiles pc
    INNER JOIN time_off_rule tor
        ON tor.id = rule_id
	INNER JOIN generate_series(0, 250) AS gs(n) ON TRUE
    CROSS JOIN LATERAL (
        SELECT pc.start_date + (
            gs.n * (tor.reset_period || ' ' || lower(tor.reset_unit::text))::interval
        ) AS period_start
    ) g
    WHERE pc.id = target_user_id
)
, filtered_periods AS (
    SELECT *
    FROM all_periods
    WHERE period_start <= requested_end_date
		AND period_end >= requested_start_date
)
, requests_overlapping AS (
    SELECT
        pp.profile_id
        , pp.period_start
        , pp.period_end
        , r.status
        , GREATEST(r.start_date::date, pp.period_start) AS clip_start
        , LEAST(r.end_date::date, pp.period_end) AS clip_end
    FROM filtered_periods pp
    INNER JOIN time_off_requests r
		ON r.user_id = pp.profile_id
    	AND r.end_date >= pp.period_start
    	AND r.start_date <= pp.period_end
    	AND r.status IN ('approved','pending')
)
, request_weekday_counts AS (
    SELECT
        ro.profile_id
        , ro.period_start
        , ro.period_end
        , ro.status
        , COUNT(*)::int AS weekday_days
    FROM requests_overlapping ro
    INNER JOIN generate_series(ro.clip_start, ro.clip_end, '1 day') AS d(the_day)
      ON EXTRACT(ISODOW FROM the_day) < 6  -- Mon–Fri only
    GROUP BY ro.profile_id
		, ro.period_start
		, ro.period_end
		, ro.status
)
, rollup AS (
    SELECT
        fp.profile_id
        , fp.period_start
        , fp.period_end
        , fp.total_amount
        , COALESCE(SUM(CASE WHEN rwc.status = 'approved' THEN rwc.weekday_days END), 0) AS used_days
        , COALESCE(SUM(CASE WHEN rwc.status = 'pending'  THEN rwc.weekday_days END), 0) AS pending_days
    FROM filtered_periods fp
    LEFT JOIN request_weekday_counts rwc
    	ON rwc.profile_id = fp.profile_id
    	AND rwc.period_start = fp.period_start
    	AND rwc.period_end = fp.period_end
    GROUP BY fp.profile_id
		, fp.period_start
		, fp.period_end
		, fp.total_amount
)
SELECT
    TO_CHAR(pp.period_start, 'YYYY/MM/DD') || '-' || TO_CHAR(pp.period_end, 'YYYY/MM/DD') AS period
	, (
		SELECT COUNT(*)
		FROM generate_series(
            GREATEST(requested_start_date::date, pp.period_start),
            LEAST(requested_end_date::date, pp.period_end),
            '1 day'
        ) AS d(the_day)
        WHERE EXTRACT(ISODOW FROM the_day) < 6       -- Mon–Fri
    ) AS days_requested_in_period
    , GREATEST(requested_start_date::date, pp.period_start) AS request_start
    , LEAST(requested_end_date::date, pp.period_end) AS request_end
    , pp.total_amount AS total_for_period
    , (pp.total_amount - rr.used_days - rr.pending_days) AS current_available
    , rr.pending_days AS current_pending
FROM filtered_periods pp
INNER JOIN rollup rr
	ON rr.profile_id = pp.profile_id
	AND rr.period_start = pp.period_start
	AND rr.period_end = pp.period_end
ORDER BY pp.profile_id, pp.period_start
$function$
;


