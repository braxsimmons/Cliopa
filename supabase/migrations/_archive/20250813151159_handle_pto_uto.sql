set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.auto_approve_time_corrections()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  WITH matches AS (
    SELECT
      c.id,
      c.time_entry_id,
      c.requested_end_time
    FROM
      public.time_corrections AS c
      LEFT JOIN public.employee_shifts AS e
        ON c.user_id = e.user_id
        AND extract(DOW FROM c.requested_end_time) = e.day_of_week
    WHERE
      c.status = 'pending'
      AND (
        (c.requested_end_time - ((DATE(c.requested_end_time) + e.morning_end) AT TIME ZONE 'America/Denver') AT TIME ZONE 'UTC') < INTERVAL '10 minutes'
        OR
        (c.requested_end_time - ((DATE(c.requested_end_time) + e.afternoon_end) AT TIME ZONE 'America/Denver') AT TIME ZONE 'UTC') < INTERVAL '10 minutes'
      )
  ),
  update_entries AS (
    UPDATE public.time_entries te
    SET
      end_time = m.requested_end_time,
      total_hours = EXTRACT(EPOCH FROM (m.requested_end_time - te.start_time)) / 3600.0,
      status = 'completed',
      updated_at = NOW()
    FROM matches m
    WHERE te.id = m.time_entry_id
    RETURNING m.id
  )
  , auto_approver_id AS (
	SELECT
		id
	FROM
		public.profiles
	WHERE
		email = 'autoapprover@tlcops.com'
  )
  UPDATE public.time_corrections
  SET
    status = 'approved',
    updated_at = NOW(),
    approved_at = NOW(),
	approved_by = (SELECT id FROM auto_approver_id)
  WHERE id IN (SELECT id FROM matches);
END;
$function$
;

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
        , tor.value AS total_amount
    FROM profiles pc
    INNER JOIN time_off_rule tor
        ON tor.id = rule_id
    INNER JOIN generate_series(0, 250) AS gs(n) ON true
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
      AND (period_end >= requested_start_date OR period_start >= requested_start_date)
)
SELECT
    TO_CHAR(pp.period_start, 'YYYY/MM/DD') || '-' || TO_CHAR(pp.period_end, 'YYYY/MM/DD') AS period
	, (
		SELECT COUNT(*)
		FROM generate_series(
				GREATEST(requested_start_date::date, pp.period_start)::date, LEAST(requested_end_date::date, pp.period_end)::date, '1 day'
			) AS d(the_day)
		WHERE EXTRACT(ISODOW FROM the_day) < 6 --Only weekdays
	)  AS days_requested_in_period
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


