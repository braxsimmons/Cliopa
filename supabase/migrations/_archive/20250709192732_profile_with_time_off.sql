set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.get_profile_with_time_off_balance(target_user_id uuid)
 RETURNS TABLE(id uuid, email text, first_name text, last_name text, role text, hourly_rate numeric, created_at timestamp with time zone, updated_at timestamp with time zone, start_date date, birthday date, team text, uto_name text, max_uto numeric, pending_uto_request numeric, available_uto numeric, pto_name text, max_pto numeric, pending_pto_request numeric, available_pto numeric, time_off_start_date_pto timestamp with time zone, time_off_end_date_pto timestamp with time zone, time_off_start_date_uto timestamp with time zone, time_off_end_date_uto timestamp with time zone)
 LANGUAGE sql
AS $function$
	WITH
	uto_cte AS (
		SELECT
			ptr.profile_id,
			tor.name AS uto_name,
			tor.value AS uto_value,
			tor.reset_period,
			tor.reset_unit,
			tor.not_before,
			tor.not_before_unit
		FROM
			public.profiles_timeoff_rules AS ptr
			INNER JOIN public.time_off_rules AS tor
				ON ptr.time_off_rule_id = tor.id
		WHERE
			tor.name = 'UTO'
	),
	pto_cte AS (
		SELECT
			ptr.profile_id,
			tor.name AS pto_name,
			tor.value AS pto_value,
			tor.reset_period,
			tor.reset_unit,
			tor.not_before,
			tor.not_before_unit
		FROM
			public.profiles_timeoff_rules AS ptr
			INNER JOIN public.time_off_rules AS tor ON ptr.time_off_rule_id = tor.id
		WHERE
			tor.name != 'UTO'
	),
	profile_cte AS (
		SELECT
			id,
			email,
			first_name,
			last_name,
			role,
			hourly_rate,
			created_at,
			updated_at,
			start_date,
			birthday,
			team
		FROM
			public.profiles
		WHERE
			id = target_user_id
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
			INNER JOIN uto_cte AS uto ON uto.profile_id = pc.id
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
			INNER JOIN pto_cte AS pto ON pto.profile_id = pc.id
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
			uto_cte.uto_name,
			uto_cte.profile_id,
			uto_cte.uto_value AS max_uto,
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
					uto_cte.not_before || ' ' || lower(uto_cte.not_before_unit::text)
				)::interval
				) THEN 0
				ELSE uto_cte.uto_value - COALESCE(
				SUM(
					CASE
					WHEN torq.status = 'approved' THEN torq.days_requested
					ELSE 0
					END
				),
				0
				)
			END AS available_uto
		FROM
			uto_cte
			INNER JOIN profile_cte AS pc ON uto_cte.profile_id = pc.id
			INNER JOIN time_off_period_uto AS top ON top.profile_id = uto_cte.profile_id
			LEFT JOIN public.time_off_requests AS torq
				ON uto_cte.profile_id = torq.user_id
				AND torq.request_type = 'UTO'
				AND torq.start_date >= top.time_off_start
				AND torq.start_date < top.time_off_end
		GROUP BY
			uto_cte.uto_name,
			uto_cte.profile_id,
			uto_cte.uto_value,
			pc.start_date,
			uto_cte.not_before,
			uto_cte.not_before_unit
	),
	pto_balance AS (
		SELECT
			pto_cte.pto_name,
			pto_cte.profile_id,
			pto_cte.pto_value AS max_pto,
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
					pto_cte.not_before || ' ' || lower(pto_cte.not_before_unit::text)
				)::interval
				) THEN 0
				ELSE pto_cte.pto_value - COALESCE(
				SUM(
					CASE
					WHEN torq.status = 'approved' THEN torq.days_requested
					ELSE 0
					END
				),
				0
				)
			END AS available_pto
		FROM
			pto_cte
			INNER JOIN profile_cte AS pc ON pto_cte.profile_id = pc.id
			INNER JOIN time_off_period_pto AS top ON top.profile_id = pto_cte.profile_id
			LEFT JOIN public.time_off_requests AS torq
				ON pto_cte.profile_id = torq.user_id
				AND torq.request_type = 'PTO'
				AND torq.start_date >= top.time_off_start
				AND torq.start_date < top.time_off_end
		GROUP BY
			pto_cte.pto_name,
			pto_cte.profile_id,
			pto_cte.pto_value,
			pc.start_date,
			pto_cte.not_before,
			pto_cte.not_before_unit
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
		topu.time_off_end AS time_off_end_date_uto
	FROM
		profile_cte AS pc
		LEFT JOIN uto_balance AS ub ON ub.profile_id = pc.id
		LEFT JOIN pto_balance AS pb ON pb.profile_id = pc.id
		LEFT JOIN time_off_period_uto AS topu ON topu.profile_id = pc.id
		LEFT JOIN time_off_period_pto AS topp ON topp.profile_id = pc.id
$function$
;


