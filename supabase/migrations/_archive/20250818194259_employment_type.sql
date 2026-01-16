drop function if exists "public"."get_profile_with_time_off_balance"(target_user_id uuid);

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.get_profile_with_time_off_balance(target_user_id uuid)
 RETURNS TABLE(id uuid, email text, first_name text, last_name text, role text, hourly_rate numeric, created_at timestamp with time zone, updated_at timestamp with time zone, start_date date, birthday date, team text, uto_name text, max_uto numeric, pending_uto_request numeric, available_uto numeric, pto_name text, max_pto numeric, pending_pto_request numeric, available_pto numeric, time_off_start_date_pto timestamp with time zone, time_off_end_date_pto timestamp with time zone, time_off_start_date_uto timestamp with time zone, time_off_end_date_uto timestamp with time zone, uto_id uuid, pto_id uuid, employment_type text)
 LANGUAGE sql
AS $function$
WITH
	profile_cte AS (
		SELECT
			p.id,
			p.email,
			p.first_name,
			p.last_name,
			p.role,
			p.hourly_rate,
			p.created_at,
			p.updated_at,
			p.start_date,
			p.birthday,
			p.team,
      		p.uto_rule,
      		p.pto_rule,
			p.employment_type
		FROM
			public.profiles AS p
		WHERE
			p.id = target_user_id
	),
	time_off_period_uto AS (
		SELECT
			gs.n,
			pc.id AS profile_id,
			pc.start_date + (
				gs.n * (
				uto.reset_period || ' ' || lower(uto.reset_unit::text)
				)::interval
			) AS time_off_start,
			pc.start_date + (
				(gs.n + 1) * (
				uto.reset_period || ' ' || lower(uto.reset_unit::text)
				)::interval
			) AS time_off_end
		FROM
			profile_cte AS pc
			INNER JOIN time_off_rules AS uto ON uto.id = pc.uto_rule
			INNER JOIN generate_series(0, 250) AS gs (n) ON true
		WHERE
			pc.start_date + (
				(gs.n + 1) * (
				uto.reset_period || ' ' || lower(uto.reset_unit::text)
				)::interval
			) >= CURRENT_DATE
		LIMIT
			1
	),
	time_off_period_pto AS (
		SELECT
			gs.n,
			pc.id AS profile_id,
			pc.start_date + (
				gs.n * (
				pto.reset_period || ' ' || lower(pto.reset_unit::text)
				)::interval
			) AS time_off_start,
			pc.start_date + (
				(gs.n + 1) * (
				pto.reset_period || ' ' || lower(pto.reset_unit::text)
				)::interval
			) AS time_off_end
		FROM
			profile_cte AS pc
			INNER JOIN time_off_rules AS pto ON pto.id = pc.pto_rule
			INNER JOIN generate_series(0, 250) AS gs (n) ON true
		WHERE
			pc.start_date + (
				(gs.n + 1) * (
				pto.reset_period || ' ' || lower(pto.reset_unit::text)
				)::interval
			) >= CURRENT_DATE
		LIMIT
			1
	),
	uto_balance AS (
		SELECT
			tor.name AS uto_name,
			pc.id AS profile_id,
			pc.uto_rule AS uto_id,
			tor.value AS max_uto,
			COALESCE(
				SUM(
				CASE
					WHEN torq.status = 'pending' THEN torq.days_requested
					ELSE 0
				END
				),
				0
			) AS pending_uto_request,
			CASE
				WHEN CURRENT_DATE < (
				pc.start_date + (
					tor.not_before || ' ' || lower(tor.not_before_unit::text)
				)::interval
				) THEN 0
				ELSE tor.value - COALESCE(
				SUM(
					CASE
					WHEN torq.status = 'approved' THEN torq.days_requested
					ELSE 0
					END
				),
				0
				) - COALESCE(
				SUM(
				CASE
					WHEN torq.status = 'pending' THEN torq.days_requested
					ELSE 0
				END
				),
				0
			)
			END AS available_uto
		FROM
			profile_cte AS pc
      INNER JOIN time_off_rules AS tor ON tor.id = pc.uto_rule
			INNER JOIN time_off_period_uto AS top ON top.profile_id = pc.id
			LEFT JOIN public.time_off_requests AS torq
				ON pc.id = torq.user_id
				AND torq.request_type = 'UTO'
				AND torq.start_date >= top.time_off_start
				AND torq.start_date < top.time_off_end
		GROUP BY
			tor.name,
			tor.value,
      		pc.id,
			pc.start_date,
			tor.not_before,
			tor.not_before_unit,
			pc.uto_rule
	),
	pto_balance AS (
		SELECT
			tor.name AS pto_name,
			pc.id AS profile_id,
			pc.pto_rule AS pto_id,
			tor.value AS max_pto,
			COALESCE(
				SUM(
				CASE
					WHEN torq.status = 'pending' THEN torq.days_requested
					ELSE 0
				END
				),
				0
			) AS pending_pto_request,
			CASE
				WHEN CURRENT_DATE < (
				pc.start_date + (
					tor.not_before || ' ' || lower(tor.not_before_unit::text)
				)::interval
				) THEN 0
				ELSE tor.value - COALESCE(
				SUM(
					CASE
					WHEN torq.status = 'approved' THEN torq.days_requested
					ELSE 0
					END
				),
				0
				) - COALESCE(
				SUM(
				CASE
					WHEN torq.status = 'pending' THEN torq.days_requested
					ELSE 0
				END
				),
				0
			)
			END AS available_pto
		FROM
			profile_cte AS pc
      INNER JOIN time_off_rules AS tor ON tor.id = pc.pto_rule
			INNER JOIN time_off_period_pto AS top ON top.profile_id = pc.id
			LEFT JOIN public.time_off_requests AS torq
				ON pc.id = torq.user_id
				AND torq.request_type = 'PTO'
				AND torq.start_date >= top.time_off_start
				AND torq.start_date < top.time_off_end
		GROUP BY
			tor.name,
			tor.value,
			pc.id,
			pc.start_date,
			tor.not_before,
			tor.not_before_unit,
			pc.pto_rule
	)
	SELECT
		pc.id,
		pc.email,
		pc.first_name,
		pc.last_name,
		pc.role,
		pc.hourly_rate,
		pc.created_at,
		pc.updated_at,
		pc.start_date,
		pc.birthday,
		pc.team,
		ub.uto_name,
		ub.max_uto,
		ub.pending_uto_request,
		ub.available_uto,
		pb.pto_name,
		pb.max_pto,
		pb.pending_pto_request,
		pb.available_pto,
		topp.time_off_start AS time_off_start_date_pto,
		topp.time_off_end AS time_off_end_date_pto,
		topu.time_off_start AS time_off_start_date_uto,
		topu.time_off_end AS time_off_end_date_uto,
		ub.uto_id,
		pb.pto_id,
		pc.employment_type
	FROM
		profile_cte AS pc
		LEFT JOIN uto_balance AS ub ON ub.profile_id = pc.id
		LEFT JOIN pto_balance AS pb ON pb.profile_id = pc.id
		LEFT JOIN time_off_period_uto AS topu ON topu.profile_id = pc.id
		LEFT JOIN time_off_period_pto AS topp ON topp.profile_id = pc.id
$function$
;


