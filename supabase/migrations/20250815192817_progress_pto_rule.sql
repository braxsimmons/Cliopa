set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.get_time_off_data(target_user_id uuid, requested_start_date timestamp with time zone, requested_end_date timestamp with time zone, rule_id uuid)
 RETURNS TABLE(period text, days_requested_in_period numeric, request_start timestamp with time zone, request_end timestamp with time zone, total_for_period numeric, current_available numeric, current_pending numeric)
 LANGUAGE sql
AS $function$
WITH user_profile AS (
    SELECT *
    FROM profiles
    WHERE id = target_user_id
),
-- combine PTO and UTO rules info
rules AS (
    SELECT
        up.id AS profile_id,
        tor.id AS rule_id,
        tor.value,
        tor.progression,
        tor.reset_period,
        tor.reset_unit,
        up.pto_rule_advance_at,
		up.start_date
    FROM user_profile up
    JOIN time_off_rules tor ON tor.id = rule_id
),
-- generate all periods within the next year
  all_periods AS (
    SELECT
        r.profile_id,
        gs.period_start::date,
        (gs.period_start + (r.reset_period || ' ' || lower(r.reset_unit::text))::interval - INTERVAL '1 day')::date AS period_end,
        CASE
            WHEN r.progression IS NOT NULL AND gs.period_start >= r.pto_rule_advance_at THEN
                (SELECT next.value FROM time_off_rules next WHERE next.id = r.progression)
            ELSE
                r.value
        END AS total_amount
    FROM rules r
    CROSS JOIN LATERAL generate_series(
        r.start_date,
        requested_end_date::date,
        (r.reset_period || ' ' || lower(r.reset_unit::text))::interval
    ) AS gs(period_start)
)
, requests_overlapping AS (
    SELECT
        ap.profile_id,
        ap.period_start,
        ap.period_end,
        r.status,
        GREATEST(r.start_date::date, ap.period_start) AS clip_start,
        LEAST(r.end_date::date, ap.period_end) AS clip_end
    FROM all_periods ap
    LEFT JOIN time_off_requests r
        ON r.user_id = ap.profile_id
       AND r.end_date >= ap.period_start
       AND r.start_date <= ap.period_end
       AND r.status IN ('approved','pending')
)
, request_weekday_counts AS (
    SELECT
        ro.profile_id,
        ro.period_start,
        ro.period_end,
        ro.status,
        COUNT(*)::int AS weekday_days
    FROM requests_overlapping ro
    JOIN generate_series(ro.clip_start, ro.clip_end, '1 day') AS d(the_day)
      ON EXTRACT(ISODOW FROM the_day) < 6 -- Mon–Fri only
    GROUP BY ro.profile_id, ro.period_start, ro.period_end, ro.status
)
, rollup AS (
    SELECT
        ap.profile_id,
        ap.period_start,
        ap.period_end,
        ap.total_amount,
        COALESCE(SUM(CASE WHEN rwc.status = 'approved' THEN rwc.weekday_days END), 0) AS used_days,
        COALESCE(SUM(CASE WHEN rwc.status = 'pending' THEN rwc.weekday_days END), 0) AS pending_days
    FROM all_periods ap
    LEFT JOIN request_weekday_counts rwc
        ON rwc.profile_id = ap.profile_id
       AND rwc.period_start = ap.period_start
       AND rwc.period_end = ap.period_end
    GROUP BY ap.profile_id, ap.period_start, ap.period_end, ap.total_amount
)
SELECT
    TO_CHAR(ap.period_start, 'YYYY/MM/DD') || '-' || TO_CHAR(ap.period_end, 'YYYY/MM/DD') AS period,
    (
        SELECT COUNT(*)
        FROM generate_series(
            GREATEST(requested_start_date::date, ap.period_start),
            LEAST(requested_end_date::date, ap.period_end),
            '1 day'
        ) AS d(the_day)
        WHERE EXTRACT(ISODOW FROM the_day) < 6
    ) AS days_requested_in_period,
    GREATEST(requested_start_date::date, ap.period_start) AS request_start,
    LEAST(requested_end_date::date, ap.period_end) AS request_end,
    ap.total_amount AS total_for_period,
    (ap.total_amount - rr.used_days - rr.pending_days) AS current_available,
    rr.pending_days AS current_pending
FROM all_periods ap
JOIN rollup rr
    ON rr.profile_id = ap.profile_id
   AND rr.period_start = ap.period_start
   AND rr.period_end = ap.period_end
WHERE (
        SELECT COUNT(*)
        FROM generate_series(
            GREATEST(requested_start_date::date, ap.period_start),
            LEAST(requested_end_date::date, ap.period_end),
            '1 day'
        ) AS d(the_day)
        WHERE EXTRACT(ISODOW FROM the_day) < 6
    ) > 0
ORDER BY ap.profile_id, ap.period_start;
$function$
;


