CREATE TYPE public.app_role AS ENUM (
    'admin',
    'manager',
    'ccm',
    'crm'
);
CREATE TYPE public.rule_unit AS ENUM (
	'DAY',
	'MONTH',
	'YEAR'
);
CREATE TABLE public.early_clock_attempts (
	id UUID NOT NULL DEFAULT gen_random_uuid (),
	user_id UUID NOT NULL,
	attempted_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
	scheduled_start TIMESTAMP WITH TIME ZONE NOT NULL,
	actual_clock_in TIMESTAMP WITH TIME ZONE NULL,
	status TEXT NOT NULL DEFAULT 'pending'::TEXT,
	team TEXT NOT NULL DEFAULT ''::TEXT,
	shift_type TEXT NOT NULL DEFAULT ''::TEXT,
	created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
	CONSTRAINT early_clock_attempts_pkey PRIMARY KEY (id),
	CONSTRAINT early_clock_attempts_status_check CHECK (
		status = any (
			array[
			'pending'::TEXT,
			'completed'::TEXT,
			'cancelled'::TEXT
			]
		)
	)
)
TABLESPACE pg_default
;
CREATE TABLE public.holidays (
	id UUID NOT NULL DEFAULT gen_random_uuid (),
	holiday_date DATE NOT NULL,
	holiday_name TEXT NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
	CONSTRAINT holidays_pkey PRIMARY KEY (id),
	CONSTRAINT holidays_holiday_date_key UNIQUE (holiday_date)
)
TABLESPACE pg_default
;
CREATE TABLE public.kpis (
  id UUID NOT NULL DEFAULT gen_random_uuid (),
  user_id UUID NOT NULL,
  metric_name TEXT NOT NULL,
  metric_value NUMERIC(10, 2) NOT NULL,
  bonus_amount NUMERIC(10, 2) NULL DEFAULT 0.00,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT kpis_pkey PRIMARY KEY (id),
  CONSTRAINT kpis_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE
)
TABLESPACE pg_default
;
CREATE TABLE public.pay_periods (
	id UUID NOT NULL DEFAULT gen_random_uuid (),
	start_date DATE NOT NULL,
	end_date DATE NOT NULL,
	period_type TEXT NOT NULL,
	status TEXT NOT NULL DEFAULT 'open'::TEXT,
	created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
	CONSTRAINT pay_periods_pkey PRIMARY KEY (id),
	CONSTRAINT pay_periods_period_type_check CHECK (
		period_type = ANY(ARRAY['first_half'::TEXT, 'second_half'::TEXT])
	),
	CONSTRAINT pay_periods_status_check CHECK (
		status = ANY(ARRAY['open'::TEXT, 'processing'::TEXT, 'closed'::TEXT])
	)
)
TABLESPACE pg_default
;
CREATE TABLE public.payroll_calculations (
	id UUID NOT NULL DEFAULT gen_random_uuid (),
	user_id UUID NOT NULL,
	pay_period_id UUID NOT NULL,
	regular_hours NUMERIC NOT NULL DEFAULT 0,
	overtime_hours NUMERIC NOT NULL DEFAULT 0,
	holiday_hours NUMERIC NOT NULL DEFAULT 0,
	pto_hours NUMERIC NOT NULL DEFAULT 0,
	hourly_rate NUMERIC NOT NULL,
	regular_pay NUMERIC NOT NULL DEFAULT 0,
	overtime_pay NUMERIC NOT NULL DEFAULT 0,
	holiday_pay NUMERIC NOT NULL DEFAULT 0,
	pto_pay NUMERIC NOT NULL DEFAULT 0,
	total_gross_pay NUMERIC NOT NULL DEFAULT 0,
	created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
	CONSTRAINT payroll_calculations_pkey PRIMARY KEY (id),
	CONSTRAINT payroll_calculations_user_id_pay_period_id_key UNIQUE (user_id, pay_period_id),
	CONSTRAINT payroll_calculations_pay_period_id_fkey FOREIGN KEY (pay_period_id) REFERENCES pay_periods (id)
)
TABLESPACE pg_default
;
CREATE TABLE public.time_off_rules (
	id UUID NOT NULL DEFAULT gen_random_uuid (),
	name TEXT NOT NULL DEFAULT ''::TEXT,
	value NUMERIC NOT NULL DEFAULT 0,
	reset_period NUMERIC NOT NULL DEFAULT 0,
	reset_unit public.rule_unit NOT NULL,
	not_before NUMERIC NOT NULL DEFAULT 0,
	not_before_unit public.rule_unit NOT NULL,
	team TEXT NOT NULL DEFAULT ''::TEXT,
	progression UUID,
	CONSTRAINT time_off_rules_pkey PRIMARY KEY (id)
)
TABLESPACE pg_default
;
CREATE TABLE public.profiles (
	id UUID NOT NULL,
	email TEXT NOT NULL,
	first_name TEXT NULL,
	last_name TEXT NULL,
	role public.app_role NOT NULL,
	hourly_rate NUMERIC(10, 2) NOT NULL DEFAULT 15.00,
	created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
	start_date DATE NULL,
	birthday DATE NULL,
	team TEXT NULL,
	pto_rule UUID DEFAULT NULL,
	uto_rule UUID DEFAULT NULL,
	pto_rule_advance_at DATE NULL,
	employment_type TEXT NOT NULL DEFAULT 'Full-Time',
	CONSTRAINT profiles_pkey PRIMARY KEY (id),
	CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users (id) ON DELETE CASCADE,
	CONSTRAINT pto_rule_fkey FOREIGN KEY (pto_rule) REFERENCES public.time_off_rules(id),
	CONSTRAINT uto_rule_fkey FOREIGN KEY (uto_rule) REFERENCES public.time_off_rules(id)
)
TABLESPACE pg_default
;
CREATE TABLE public.time_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid (),
  user_id UUID NOT NULL,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NULL,
  total_hours NUMERIC(10, 2) NULL,
  status TEXT NOT NULL DEFAULT 'active'::TEXT,
  team TEXT NOT NULL DEFAULT ''::TEXT,
  shift_type TEXT NOT NULL DEFAULT ''::TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  verified TIMESTAMPTZ,
  CONSTRAINT time_entries_pkey PRIMARY KEY (id),
  CONSTRAINT time_entries_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles (id) ON DELETE CASCADE,
  CONSTRAINT time_entries_status_check CHECK (
      status = ANY(ARRAY['active'::TEXT, 'completed'::TEXT])
  )
)
TABLESPACE pg_default
;

CREATE UNIQUE INDEX one_active_time_entry_per_user
  ON public.time_entries (user_id)
  WHERE status = 'active';
CREATE TABLE public.time_off_requests (
	id UUID NOT NULL DEFAULT gen_random_uuid (),
	user_id UUID NOT NULL,
	request_type TEXT NOT NULL,
	start_date DATE NOT NULL,
	end_date DATE NOT NULL,
	days_requested NUMERIC NOT NULL,
	reason TEXT NULL,
	status TEXT NOT NULL DEFAULT 'pending'::TEXT,
	approved_by UUID NULL,
	approved_at TIMESTAMP WITH TIME ZONE NULL,
	created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
	approval_notes TEXT NULL,
	CONSTRAINT time_off_requests_pkey PRIMARY KEY (id),
	CONSTRAINT time_off_requests_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.profiles (id),
	CONSTRAINT time_off_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles (id) ON DELETE CASCADE,
	CONSTRAINT time_off_requests_request_type_check CHECK (
		request_type = ANY(ARRAY['PTO'::TEXT, 'UTO'::TEXT])
	),
	CONSTRAINT time_off_requests_status_check CHECK (
		status = ANY(ARRAY['pending'::TEXT, 'approved'::TEXT, 'denied'::TEXT, 'exception'::TEXT])
	)
)
TABLESPACE pg_default
;

CREATE INDEX IF NOT EXISTS idx_time_off_requests_user_id
	ON public.time_off_requests
	USING BTREE (user_id)
	TABLESPACE pg_default
;

CREATE INDEX IF NOT EXISTS idx_time_off_requests_status
	ON public.time_off_requests
	USING BTREE (status)
	TABLESPACE pg_default
;
CREATE TABLE public.approved_time_off (
	id UUID NOT NULL DEFAULT gen_random_uuid (),
	user_id UUID NOT NULL,
	request_id UUID NULL,
	start_date DATE NOT NULL,
	end_date DATE NOT NULL,
	days_taken NUMERIC NOT NULL,
	request_type TEXT NOT NULL,
	hourly_rate NUMERIC NULL,
	total_pay NUMERIC GENERATED ALWAYS AS (
		CASE
			WHEN (request_type = 'PTO'::text) THEN ((days_taken * (8)::NUMERIC) * hourly_rate)
			ELSE (0)::NUMERIC
		END
	) STORED NULL,
	created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
	CONSTRAINT approved_time_off_pkey PRIMARY key (id),
	CONSTRAINT approved_time_off_request_id_fkey FOREIGN KEY (request_id) REFERENCES time_off_requests (id) ON DELETE CASCADE,
	CONSTRAINT approved_time_off_request_type_check CHECK (
		request_type = ANY(ARRAY['PTO'::TEXT, 'UTO'::TEXT])
	)
)
TABLESPACE pg_default
;

CREATE INDEX IF NOT EXISTS idx_approved_time_off_user_date
	ON public.approved_time_off
	USING BTREE (user_id, start_date, end_date)
	TABLESPACE pg_default
;
CREATE TABLE public.employee_shifts (
	id UUID NOT NULL DEFAULT gen_random_uuid (),
	user_id UUID NOT NULL,
	day_of_week INTEGER NOT NULL,
	is_working_day BOOLEAN NULL DEFAULT TRUE,
	created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
	morning_start TIME WITHOUT TIME ZONE NULL,
	morning_end time WITHOUT TIME ZONE NULL,
	afternoon_start TIME WITHOUT TIME ZONE NULL,
	afternoon_end time WITHOUT TIME ZONE NULL,
	CONSTRAINT employee_shifts_pkey PRIMARY KEY (id),
	CONSTRAINT employee_shifts_user_id_day_of_week_key UNIQUE (user_id, day_of_week),
	CONSTRAINT employee_shifts_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles (id) ON DELETE CASCADE,
	CONSTRAINT employee_shifts_day_of_week_check CHECK (
		(day_of_week >= 0)
		AND (day_of_week <= 6)
	)
)
TABLESPACE pg_default
;
CREATE TABLE public.time_corrections (
	id UUID NOT NULL DEFAULT gen_random_uuid (),
	user_id UUID NOT NULL,
	time_entry_id UUID NOT NULL,
	requested_start_time TIMESTAMP WITH TIME ZONE,
	requested_end_time TIMESTAMP WITH TIME ZONE,
	reason TEXT NOT NULL,
	status TEXT NOT NULL DEFAULT 'pending'::TEXT,
	team TEXT,
	shift_type TEXT,
	approved_by UUID NULL,
	approved_at TIMESTAMP WITH TIME ZONE NULL,
	review_notes TEXT NULL,
	created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
	CONSTRAINT time_corrections_pkey PRIMARY KEY (id),
	CONSTRAINT time_corrections_time_entry_id_fkey FOREIGN KEY (time_entry_id) REFERENCES public.time_entries (id) ON DELETE CASCADE,
	CONSTRAINT time_corrections_status_check CHECK (
		status = ANY(ARRAY['pending'::TEXT, 'approved'::TEXT, 'denied'::TEXT])
	)
)
TABLESPACE pg_default
;
CREATE FUNCTION public.approve_time_correction(
	correction_id UUID
	, approver_id UUID
	, notes TEXT DEFAULT NULL::TEXT
) RETURNS boolean
    LANGUAGE plpgsql
	SET search_path = ''
	SECURITY DEFINER
AS $$
DECLARE
	correction_record RECORD;
BEGIN
	-- Get the correction details
	SELECT *
	INTO correction_record
	FROM public.time_corrections
	WHERE
		id = correction_id
		AND status = 'pending'
	;

	IF NOT FOUND THEN
	RAISE EXCEPTION 'Correction not found or already processed';
	END IF;

	-- Update the correction status
	UPDATE public.time_corrections
	SET
		status = 'approved',
		approved_by = approver_id,
		approved_at = NOW(),
		review_notes = notes,
		updated_at = NOW()
	WHERE
		id = correction_id
	;

	RETURN TRUE;
END;
$$;
CREATE FUNCTION public.approve_time_off_request(
	request_id UUID
	, approver_id UUID
) RETURNS boolean
    LANGUAGE plpgsql
	SET search_path = ''
	SECURITY DEFINER
    AS $$
DECLARE
	request_record RECORD;
	user_profile RECORD;
BEGIN
	-- Get the request details
	SELECT
		user_id
		, start_date
		, end_date
		, days_requested
		, request_type
	INTO request_record
	FROM public.time_off_requests
	WHERE
		id = request_id
		AND status = 'pending'
	;

	IF NOT FOUND THEN
	RAISE EXCEPTION 'Request not found or already processed';
	END IF;

	-- Get user profile for hourly rate
	SELECT
		hourly_rate
	INTO user_profile
	FROM public.profiles
	WHERE
		id = request_record.user_id
	;

	-- Update the request status
	UPDATE public.time_off_requests
	SET
		status = 'approved',
		approved_by = approver_id,
		approved_at = NOW(),
		updated_at = NOW()
	WHERE
		id = request_id
	;

	-- Create approved time off record
	INSERT INTO public.approved_time_off (
		user_id,
		request_id,
		start_date,
		end_date,
		days_taken,
		request_type,
		hourly_rate
	) VALUES (
		request_record.user_id,
		request_id,
		request_record.start_date,
		request_record.end_date,
		request_record.days_requested,
		request_record.request_type,
		user_profile.hourly_rate
	);

	RETURN TRUE;
END;
$$;
CREATE FUNCTION public.auto_approve_time_corrections()
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
	  AND c.reason NOT LIKE 'Manual Entry:%'
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

CREATE FUNCTION public.auto_end_shift(
	user_id_param uuid
	, time_entry_id_param uuid
) RETURNS boolean
    LANGUAGE plpgsql
	SET search_path = ''
	SECURITY DEFINER
    AS $$
DECLARE
	shift_record RECORD;
	end_time TIMESTAMP WITH TIME ZONE;
BEGIN
	-- Get the time entry and calculate end time based on schedule
	SELECT
		te.start_time
		, es.morning_end
		, es.afternoon_end
	INTO shift_record
	FROM
		time_entries AS te
		LEFT JOIN employee_shifts AS es
			ON es.user_id = te.user_id
				AND es.day_of_week = EXTRACT(DOW FROM te.start_time)
	WHERE
		te.id = time_entry_id_param
		AND te.user_id = user_id_param
		AND te.status = 'active'
	;

	IF NOT FOUND THEN
	RETURN FALSE;
	END IF;

	-- Determine if this is morning or afternoon shift and set appropriate end time
	IF EXTRACT(HOUR FROM shift_record.start_time) < 12 THEN
		-- Morning shift
		end_time := DATE_TRUNC('day', shift_record.start_time) + shift_record.morning_end;
	ELSE
		-- Afternoon shift
		end_time := DATE_TRUNC('day', shift_record.start_time) + shift_record.afternoon_end;
	END IF;

	-- Update the time entry
	UPDATE time_entries
	SET
		end_time = end_time,
		total_hours = EXTRACT(EPOCH FROM (end_time - start_time)) / 3600.0,
		status = 'auto_ended',
		updated_at = now()
	WHERE
		id = time_entry_id_param
	;

	RETURN TRUE;
	END;
$$;
CREATE FUNCTION public.calculate_payroll_for_period(
	pay_period_id_param uuid
) RETURNS void
    LANGUAGE plpgsql
	SET search_path = ''
	SECURITY DEFINER
    AS $$
DECLARE
  period_record RECORD;
  user_record RECORD;
  regular_hours_calc NUMERIC;
  overtime_hours_calc NUMERIC;
  holiday_hours_calc NUMERIC;
  pto_hours_calc NUMERIC;
  regular_pay_calc NUMERIC;
  overtime_pay_calc NUMERIC;
  holiday_pay_calc NUMERIC;
  pto_pay_calc NUMERIC;
  total_gross_calc NUMERIC;
BEGIN
  -- Get pay period details
  SELECT * INTO period_record FROM public.pay_periods WHERE id = pay_period_id_param;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pay period not found';
  END IF;

  -- Loop through all users with profiles
  FOR user_record IN
    SELECT id, hourly_rate FROM public.profiles
  LOOP
    -- Calculate regular hours from time_entries (shifts only)
    SELECT COALESCE(SUM(total_hours), 0) INTO regular_hours_calc
    FROM public.time_entries
    WHERE user_id = user_record.id
      AND DATE(start_time) BETWEEN period_record.start_date AND period_record.end_date
      AND status IN ('completed', 'auto_ended', 'manual_ended')
      AND total_hours <= 40; -- Regular hours cap at 40 per week

    -- Calculate overtime hours (this is simplified - in reality you'd need weekly calculations)
    SELECT COALESCE(SUM(GREATEST(total_hours - 40, 0)), 0) INTO overtime_hours_calc
    FROM public.time_entries
    WHERE user_id = user_record.id
      AND DATE(start_time) BETWEEN period_record.start_date AND period_record.end_date
      AND status IN ('completed', 'auto_ended', 'manual_ended')
      AND total_hours > 40;

    -- Calculate holiday hours
    SELECT COALESCE(COUNT(*) * 8, 0) INTO holiday_hours_calc
    FROM public.holidays
    WHERE holiday_date BETWEEN period_record.start_date AND period_record.end_date;

    -- Calculate PTO hours (exclude UTO)
    SELECT COALESCE(SUM(days_taken * 8), 0) INTO pto_hours_calc
    FROM public.approved_time_off
    WHERE user_id = user_record.id
      AND request_type = 'PTO'
      AND start_date <= period_record.end_date
      AND end_date >= period_record.start_date;

    -- Calculate pay amounts
    regular_pay_calc := regular_hours_calc * user_record.hourly_rate;
    overtime_pay_calc := overtime_hours_calc * user_record.hourly_rate * 1.5;
    holiday_pay_calc := holiday_hours_calc * user_record.hourly_rate;
    pto_pay_calc := pto_hours_calc * user_record.hourly_rate;
    total_gross_calc := regular_pay_calc + overtime_pay_calc + holiday_pay_calc + pto_pay_calc;

    -- Insert or update payroll calculation
    INSERT INTO public.payroll_calculations (
      user_id, pay_period_id, regular_hours, overtime_hours, holiday_hours, pto_hours,
      hourly_rate, regular_pay, overtime_pay, holiday_pay, pto_pay, total_gross_pay
    ) VALUES (
      user_record.id, pay_period_id_param, regular_hours_calc, overtime_hours_calc,
      holiday_hours_calc, pto_hours_calc, user_record.hourly_rate, regular_pay_calc,
      overtime_pay_calc, holiday_pay_calc, pto_pay_calc, total_gross_calc
    )
    ON CONFLICT (user_id, pay_period_id)
    DO UPDATE SET
      regular_hours = EXCLUDED.regular_hours,
      overtime_hours = EXCLUDED.overtime_hours,
      holiday_hours = EXCLUDED.holiday_hours,
      pto_hours = EXCLUDED.pto_hours,
      hourly_rate = EXCLUDED.hourly_rate,
      regular_pay = EXCLUDED.regular_pay,
      overtime_pay = EXCLUDED.overtime_pay,
      holiday_pay = EXCLUDED.holiday_pay,
      pto_pay = EXCLUDED.pto_pay,
      total_gross_pay = EXCLUDED.total_gross_pay,
      updated_at = now();
  END LOOP;
END;
$$;
CREATE FUNCTION public.calculate_total_hours()
RETURNS trigger
    LANGUAGE plpgsql
	SET search_path = ''
    AS $$
BEGIN
	IF NEW.end_time IS NOT NULL
		AND NEW.start_time IS NOT NULL THEN
		NEW.total_hours = EXTRACT(EPOCH FROM (NEW.end_time - NEW.start_time)) / 3600.0;
		NEW.status = 'completed';
	END IF;
	NEW.updated_at = NOW();
	RETURN NEW;
END;
$$;
CREATE OR REPLACE FUNCTION public.delete_time_off_request(request_id uuid)
RETURNS void
language sql
as $$
  DELETE FROM public.time_off_requests
  WHERE id = request_id
$$;
CREATE OR REPLACE FUNCTION public.deny_time_correction(
	correction_id UUID
	, notes TEXT DEFAULT NULL::TEXT
) RETURNS boolean
    LANGUAGE plpgsql
	SET search_path = ''
	SECURITY DEFINER
AS $$
DECLARE
	correction_record RECORD;
BEGIN
	-- Get the correction details
	SELECT *
	INTO correction_record
	FROM public.time_corrections
	WHERE
		id = correction_id
		AND status = 'pending'
	;

	IF NOT FOUND THEN
	RAISE EXCEPTION 'Correction not found or already processed';
	END IF;

	-- Update the correction status
	UPDATE public.time_corrections
	SET
		status = 'denied',
		review_notes = notes,
		updated_at = NOW()
	WHERE
		id = correction_id
	;

	RETURN TRUE;
END;
$$;
CREATE FUNCTION public.deny_time_off_request(
	request_id uuid
	, approver_id uuid
) RETURNS boolean
    LANGUAGE plpgsql
	SET search_path = ''
	SECURITY DEFINER
    AS $$
BEGIN
	-- Update the request status
	UPDATE public.time_off_requests
	SET
		status = 'denied',
		approved_by = approver_id,
		approved_at = NOW(),
		updated_at = NOW()
	WHERE
		id = request_id
		AND status = 'pending'
	;

	IF NOT FOUND THEN
	RAISE EXCEPTION 'Request not found or already processed';
	END IF;

	RETURN TRUE;
	END;
$$;
CREATE FUNCTION public.exception_time_off_request(
	request_id uuid
	, approver_id uuid
) RETURNS boolean
    LANGUAGE plpgsql
	SET search_path = ''
	SECURITY DEFINER
    AS $$
BEGIN
	-- Update the request status
	UPDATE public.time_off_requests
	SET
		status = 'exception',
		approved_by = approver_id,
		approved_at = NOW(),
		updated_at = NOW()
	WHERE
		id = request_id
		AND status = 'pending'
	;

	IF NOT FOUND THEN
	RAISE EXCEPTION 'Request not found or already processed';
	END IF;

	RETURN TRUE;
	END;
$$;
CREATE FUNCTION public.generate_pay_periods_for_year(
	year_param integer
) RETURNS void
    LANGUAGE plpgsql
	SET search_path = ''
	SECURITY DEFINER
    AS $$
DECLARE
  month_num INTEGER;
  first_half_start DATE;
  first_half_end DATE;
  second_half_start DATE;
  second_half_end DATE;
BEGIN
  FOR month_num IN 1..12 LOOP
    -- First half: 8th to 23rd
    first_half_start := DATE(year_param || '-' || LPAD(month_num::TEXT, 2, '0') || '-08');
    first_half_end := DATE(year_param || '-' || LPAD(month_num::TEXT, 2, '0') || '-23');

    -- Second half: 24th to 7th of next month
    second_half_start := DATE(year_param || '-' || LPAD(month_num::TEXT, 2, '0') || '-24');
    IF month_num = 12 THEN
      second_half_end := DATE((year_param + 1) || '-01-07');
    ELSE
      second_half_end := DATE(year_param || '-' || LPAD((month_num + 1)::TEXT, 2, '0') || '-07');
    END IF;

    -- Insert pay periods
    INSERT INTO public.pay_periods (start_date, end_date, period_type)
    VALUES
      (first_half_start, first_half_end, 'first_half'),
      (second_half_start, second_half_end, 'second_half')
    ON CONFLICT DO NOTHING;
  END LOOP;
END;
$$;
CREATE FUNCTION public.get_completed_time_entries()
RETURNS TABLE (
	id uuid,
	start_time timestamptz,
	end_time timestamptz,
	team text,
	shift_type text,
	status text,
	total_hours numeric,
	first_name text,
	last_name text,
	email text,
	verified timestamptz
) AS $$
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
$$ LANGUAGE sql
;
CREATE FUNCTION public.get_profile_with_time_off_balance(
	target_user_id uuid
) RETURNS TABLE(
	id uuid,
 	email text,
  	first_name text,
   	last_name text,
    role text,
	hourly_rate numeric,
	created_at timestamptz,
	updated_at timestamptz,
	start_date date,
	birthday date,
	team text,
	uto_name text,
	max_uto numeric,
	pending_uto_request numeric,
	available_uto numeric,
	pto_name text,
	max_pto numeric,
	pending_pto_request numeric,
	available_pto numeric,
	time_off_start_date_pto timestamptz,
	time_off_end_date_pto timestamptz,
	time_off_start_date_uto timestamptz,
	time_off_end_date_uto timestamptz,
	uto_id uuid,
	pto_id uuid,
	employment_type text
) AS $$
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
$$ LANGUAGE sql;
CREATE FUNCTION public.get_recent_shifts(
	target_user_id uuid,
	num_shifts numeric
) RETURNS TABLE(
	id uuid,
	start_time timestamptz,
	end_time timestamptz,
	team text,
	shift_type text,
	status text,
	total_hours numeric,
	verified timestamptz
) AS $$
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
$$ LANGUAGE sql
;
CREATE FUNCTION public.get_time_off_data(
	target_user_id uuid,
	requested_start_date timestamptz,
	requested_end_date timestamptz,
	rule_id uuid
) RETURNS TABLE(
	period text,
	days_requested_in_period numeric,
	request_start timestamptz,
	request_end timestamptz,
	total_for_period numeric,
	current_available numeric,
	current_pending numeric
) AS $$
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
		CASE
			WHEN tor.name ILIKE '%PTO%' THEN 'PTO'
			WHEN tor.name ILIKE '%UTO%' THEN 'UTO'
			ELSE 'Other'
		END AS rule_type,
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
		r.rule_type,
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
	   AND r.request_type = ap.rule_type
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
$$ LANGUAGE sql;
CREATE FUNCTION public.get_user_roles(
	target_user_id uuid DEFAULT auth.uid()
) RETURNS public.app_role[]
    LANGUAGE sql
	SET search_path = ''
	STABLE
	SECURITY DEFINER
AS $$
	SELECT ARRAY_AGG(role)
	FROM public.profiles
	WHERE id = target_user_id;
$$;
CREATE FUNCTION public.get_weekly_hours(
	target_user_id uuid
) RETURNS TABLE(
	week_start_date date,
	monday_hours numeric,
	tuesday_hours numeric,
	wednesday_hours numeric,
	thursday_hours numeric,
	friday_hours numeric,
	total_week_hours numeric,
	all_verified bool,
	unverified_ids uuid[],
	verified_ids uuid[],
	has_pending_entries bool
) AS $$
WITH base_data AS (
	SELECT
		te.user_id,
		te.id,
		COALESCE((
			SELECT status
			FROM public.time_corrections AS tc
			WHERE tc.time_entry_id = te.id
			ORDER BY tc.created_at DESC
			LIMIT 1
		), te.status) AS status,
		COALESCE((
			SELECT tc.requested_start_time
			FROM public.time_corrections tc
			WHERE tc.requested_start_time IS NOT NULL
				AND tc.status != 'denied'
				AND tc.time_entry_id = te.id
				AND tc.user_id = target_user_id
			ORDER BY tc.updated_at DESC
			LIMIT 1
		), te.start_time) AS current_start_time,
		COALESCE((
			SELECT tc.requested_end_time
			FROM public.time_corrections tc
			WHERE tc.requested_end_time IS NOT NULL
				AND tc.status != 'denied'
				AND tc.time_entry_id = te.id
				AND tc.user_id = target_user_id
			ORDER BY tc.updated_at DESC
			LIMIT 1
		), te.end_time) AS current_end_time,
		COALESCE((
			SELECT tc.team
			FROM public.time_corrections tc
			WHERE tc.team IS NOT NULL
				AND tc.status != 'denied'
				AND tc.time_entry_id = te.id
				AND tc.user_id = target_user_id
			ORDER BY tc.updated_at DESC
			LIMIT 1
		), te.team) AS current_team,
		COALESCE((
			SELECT tc.shift_type
			FROM public.time_corrections tc
			WHERE tc.shift_type IS NOT NULL
				AND tc.status != 'denied'
				AND tc.time_entry_id = te.id
				AND tc.user_id = target_user_id
			ORDER BY tc.updated_at DESC
			LIMIT 1
		), te.shift_type) AS current_shift_type,
		te.verified
	FROM public.time_entries te
	WHERE te.user_id = target_user_id
		AND te.status != 'active'
),
enriched_data AS (
	SELECT
		id,
		current_start_time,
		current_end_time,
		current_team,
		current_shift_type,
		status,
		verified,
		ROUND(EXTRACT(EPOCH FROM (current_end_time - current_start_time)) / 3600.0, 2) AS hours,
		DATE_TRUNC('week', current_start_time)::date AS week_start,
		EXTRACT(ISODOW FROM current_start_time) AS day_of_week
	FROM base_data
)
SELECT
	week_start AS week_start_date,
	COALESCE(SUM(hours) FILTER (WHERE day_of_week = 1), 0) AS monday_hours,
	COALESCE(SUM(hours) FILTER (WHERE day_of_week = 2), 0) AS tuesday_hours,
	COALESCE(SUM(hours) FILTER (WHERE day_of_week = 3), 0) AS wednesday_hours,
	COALESCE(SUM(hours) FILTER (WHERE day_of_week = 4), 0) AS thursday_hours,
	COALESCE(SUM(hours) FILTER (WHERE day_of_week = 5), 0) AS friday_hours,
	COALESCE(SUM(hours) FILTER (WHERE day_of_week BETWEEN 1 AND 5), 0) AS total_week_hours,
	BOOL_AND(verified IS NOT NULL) AS all_verified,
	ARRAY_AGG(id) FILTER (WHERE verified IS NULL) AS unverified_ids,
	ARRAY_AGG(id) FILTER (WHERE verified IS NOT NULL) AS verified_ids,
	BOOL_OR(status = 'pending') AS has_pending_entries
FROM enriched_data
WHERE day_of_week BETWEEN 1 AND 5  -- Only Monday through Friday
GROUP BY week_start
ORDER BY week_start DESC
$$ LANGUAGE sql
;
CREATE FUNCTION public.handle_new_user()
RETURNS trigger
    LANGUAGE plpgsql
	SET search_path = ''
	SECURITY DEFINER
    AS $$
BEGIN
	WITH uto_id AS (
	SELECT
		ID
	FROM
		public.time_off_rules
	WHERE
		name = 'UTO'
	)
	INSERT INTO public.profiles (
		id, email, first_name, last_name, role, uto_rule
	)
	VALUES (
		NEW.id,
		NEW.email,
		COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
		COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
		COALESCE(NEW.raw_user_meta_data->>'role', 'ccm')::public.app_role,
		(SELECT id FROM uto_id)
	);

	RETURN NEW;
END;
$$;
CREATE FUNCTION public.has_any_role(
	target_roles public.app_role[]
	, target_user_id uuid DEFAULT auth.uid()
) RETURNS boolean
    LANGUAGE sql
	SET search_path = ''
	STABLE
	SECURITY DEFINER
AS $$
	SELECT EXISTS (
		SELECT 1
		FROM public.profiles
		WHERE
			id = target_user_id
			AND role = ANY(target_roles)
	);
$$;
CREATE FUNCTION public.has_role(
	target_role public.app_role
	, target_user_id uuid DEFAULT auth.uid()
) RETURNS boolean
    LANGUAGE sql
	SET search_path = ''
	STABLE
	SECURITY DEFINER
AS $$
	SELECT EXISTS (
		SELECT 1
		FROM public.profiles
		WHERE
			id = target_user_id
			AND role = target_role
	);
$$;
CREATE FUNCTION public.reset_quarterly_uto_balances()
RETURNS void
    LANGUAGE plpgsql
	SET search_path = ''
	SECURITY DEFINER
AS $$
BEGIN
	UPDATE public.profiles
	SET uto_balance = 3.00;
END;
$$;
CREATE FUNCTION public.get_time_corrections_all_pending(
) RETURNS TABLE(
	original_start_time timestamptz
	, original_end_time timestamptz
	, original_team text
	, original_shift_type text
	, requested_start_time timestamptz
	, requested_end_time timestamptz
	, requested_team text
	, requested_shift_type text
	, current_start_time timestamptz
	, current_end_time timestamptz
	, current_team text
	, current_shift_type text
	, status text
	, reason text
	, created_at timestamptz
	, first_name text
	, last_name text
	, email text
	, id uuid
) AS $$
WITH tc_cte AS (
	SELECT
		requested_start_time,
		requested_end_time,
		team AS requested_team,
		shift_type AS requested_shift_type,
		status,
		reason,
		created_at,
		time_entry_id,
		id
	FROM public.time_corrections
	WHERE status = 'pending'
)
SELECT
	te.start_time AS original_start_time
	,te.end_time AS original_end_time
	,te.team AS original_team
	, te.shift_type AS original_shift_type
	, tc.requested_start_time
	, tc.requested_end_time
	, tc.requested_team
	, tc.requested_shift_type
	, COALESCE((
		SELECT tc2.requested_start_time
		FROM public.time_corrections tc2
		WHERE tc2.time_entry_id = tc.time_entry_id
			AND tc2.created_at < tc.created_at
			AND tc2.status = 'approved'
			AND tc2.requested_start_time IS NOT NULL
		ORDER BY tc2.created_at DESC
		LIMIT 1
	), te.start_time) AS current_start_time
	, COALESCE((
		SELECT tc2.requested_end_time
		FROM public.time_corrections tc2
		WHERE tc2.time_entry_id = tc.time_entry_id
			AND tc2.created_at < tc.created_at
			AND tc2.status = 'approved'
			AND tc2.requested_end_time IS NOT NULL
		ORDER BY tc2.created_at DESC
		LIMIT 1
	), te.end_time) AS current_end_time
	, COALESCE((
		SELECT tc2.team
		FROM public.time_corrections tc2
		WHERE tc2.time_entry_id = tc.time_entry_id
			AND tc2.created_at < tc.created_at
			AND tc2.status = 'approved'
			AND tc2.team IS NOT NULL
		ORDER BY tc2.created_at DESC
		LIMIT 1
	), te.team) AS current_team
	, COALESCE((
		SELECT tc2.shift_type
		FROM public.time_corrections tc2
		WHERE tc2.time_entry_id = tc.time_entry_id
			AND tc2.created_at < tc.created_at
			AND tc2.status = 'approved'
			AND tc2.shift_type IS NOT NULL
		ORDER BY tc2.created_at DESC
		LIMIT 1
	), te.shift_type) AS current_shift_type
	, tc.status
	, tc.reason
	, tc.created_at
	, p.first_name
	, p.last_name
	, p.email
	, tc.id
FROM public.time_entries te
JOIN tc_cte tc
	ON te.id = tc.time_entry_id
LEFT JOIN public.profiles p
	ON p.id = te.user_id
ORDER BY tc.created_at DESC;
$$ LANGUAGE sql
;
CREATE FUNCTION public.get_all_time_corrections_user(
	target_user_id uuid
) RETURNS TABLE(
	original_start_time timestamptz
	, original_end_time timestamptz
	, original_team text
	, original_shift_type text
	, requested_start_time timestamptz
	, requested_end_time timestamptz
	, requested_team text
	, requested_shift_type text
	, current_start_time timestamptz
	, current_end_time timestamptz
	, current_team text
	, current_shift_type text
	, status text
	, reason text
	, review_notes text
	, approved_at timestamptz
	, approved_by text
	, created_at timestamptz
) AS $$
WITH tc_cte AS (
	SELECT
		requested_start_time,
		requested_end_time,
		team AS requested_team,
		shift_type AS requested_shift_type,
		review_notes,
		status,
		reason,
		approved_at,
		approved_by,
		created_at,
		time_entry_id,
		id
	FROM public.time_corrections
	WHERE user_id = target_user_id
)
SELECT
	te.start_time AS original_start_time
	,te.end_time AS original_end_time
	,te.team AS original_team
	, te.shift_type AS original_shift_type
	, tc.requested_start_time
	, tc.requested_end_time
	, tc.requested_team
	, tc.requested_shift_type
	, COALESCE((
		SELECT tc2.requested_start_time
		FROM public.time_corrections tc2
		WHERE tc2.time_entry_id = tc.time_entry_id
			AND tc2.created_at < tc.created_at
			AND tc2.status = 'approved'
			AND tc2.requested_start_time IS NOT NULL
		ORDER BY tc2.created_at DESC
		LIMIT 1
	), te.start_time) AS current_start_time
	, COALESCE((
		SELECT tc2.requested_end_time
		FROM public.time_corrections tc2
		WHERE tc2.time_entry_id = tc.time_entry_id
			AND tc2.created_at < tc.created_at
			AND tc2.status = 'approved'
			AND tc2.requested_end_time IS NOT NULL
		ORDER BY tc2.created_at DESC
		LIMIT 1
	), te.end_time) AS current_end_time
	, COALESCE((
		SELECT tc2.team
		FROM public.time_corrections tc2
		WHERE tc2.time_entry_id = tc.time_entry_id
			AND tc2.created_at < tc.created_at
			AND tc2.status = 'approved'
			AND tc2.team IS NOT NULL
		ORDER BY tc2.created_at DESC
		LIMIT 1
	), te.team) AS current_team
	, COALESCE((
		SELECT tc2.shift_type
		FROM public.time_corrections tc2
		WHERE tc2.time_entry_id = tc.time_entry_id
			AND tc2.created_at < tc.created_at
			AND tc2.status = 'approved'
			AND tc2.shift_type IS NOT NULL
		ORDER BY tc2.created_at DESC
		LIMIT 1
	), te.shift_type) AS current_shift_type
	, tc.status
	, tc.reason
	, tc.review_notes
	, tc.approved_at
	, (p.first_name || ' ' || p.last_name) AS approved_by
	, tc.created_at

FROM public.time_entries te
JOIN tc_cte tc
	ON te.id = tc.time_entry_id
LEFT JOIN public.profiles p
	ON p.id = tc.approved_by
ORDER BY tc.created_at DESC;
$$ LANGUAGE sql
;
CREATE FUNCTION public.update_employee_shifts_updated_at()
RETURNS trigger
    LANGUAGE plpgsql
	SET search_path = ''
AS $$
BEGIN
	NEW.updated_at = NOW();
	RETURN NEW;
END;
$$;
CREATE FUNCTION public.update_pto_balance_on_time_off()
RETURNS trigger
    LANGUAGE plpgsql
	SET search_path = ''
	SECURITY DEFINER
AS $$
BEGIN
	IF NEW.time_off_type = 'PTO' THEN
		UPDATE public.profiles
		SET pto_balance = pto_balance - NEW.days_taken
		WHERE id = NEW.user_id;
	END IF;
	RETURN NEW;
END;
$$;
CREATE TRIGGER insert_new_profile
    AFTER INSERT ON auth.users
    FOR EACH ROW
        EXECUTE FUNCTION handle_new_user()
;CREATE TRIGGER employee_shifts_updated_at
	BEFORE UPDATE ON employee_shifts
	FOR EACH ROW
	EXECUTE FUNCTION update_employee_shifts_updated_at()
;
CREATE TRIGGER calculate_hours_trigger
BEFORE UPDATE ON time_entries
FOR EACH ROW
EXECUTE FUNCTION calculate_total_hours();
CREATE POLICY "Admins and managers or the owner can view approved time off"
	ON public.approved_time_off
	FOR SELECT
	TO authenticated
	USING ((
		(SELECT auth.uid()) = user_id
		OR (SELECT public.has_any_role(ARRAY['admin'::public.app_role, 'manager'::public.app_role]))
	))
;

CREATE POLICY "Only admins and managers can insert approved time off"
	ON public.approved_time_off
	FOR INSERT
	TO authenticated
	WITH CHECK ((SELECT public.has_any_role(ARRAY['admin'::public.app_role, 'manager'::public.app_role])))
;

CREATE POLICY "Users can view their own approved time off"
	ON public.approved_time_off
	FOR SELECT
	TO authenticated
	USING (((SELECT auth.uid()) = user_id))
;
ALTER TABLE public.approved_time_off ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can create their own early clock attempts"
	ON public.early_clock_attempts
	FOR INSERT
	TO authenticated
	WITH CHECK (((SELECT auth.uid()) = user_id))
;

CREATE POLICY "Users can update their own early clock attempts"
	ON public.early_clock_attempts
	FOR UPDATE
	TO authenticated
	USING (((SELECT auth.uid()) = user_id))
;

CREATE POLICY "Users can view their own early clock attempts"
	ON public.early_clock_attempts
	FOR SELECT
	TO authenticated
	USING (((SELECT auth.uid()) = user_id))
;

ALTER TABLE public.early_clock_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can delete employee shifts"
	ON public.employee_shifts
	FOR DELETE
	TO authenticated
	USING (((SELECT public.has_any_role(ARRAY['admin'::public.app_role]))))
;

CREATE POLICY "Admins can insert employee shifts"
	ON public.employee_shifts
	FOR INSERT
	TO authenticated
	WITH CHECK (((SELECT public.has_any_role(ARRAY['admin'::public.app_role]))))
;

CREATE POLICY "Admins can update employee shifts"
	ON public.employee_shifts
	FOR UPDATE
	TO authenticated
	USING (((SELECT public.has_any_role(ARRAY['admin'::public.app_role]))))
;

CREATE POLICY "Users can view all employee shifts"
	ON public.employee_shifts
	FOR SELECT
	TO authenticated
	USING (true)
;

ALTER TABLE public.employee_shifts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage holidays"
	ON public.holidays
	TO authenticated
	USING ((SELECT public.has_any_role(ARRAY['admin'::public.app_role])))
;

ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage pay periods"
	ON public.pay_periods
	FOR ALL
	TO authenticated
	USING ((SELECT public.has_any_role(ARRAY['admin'::public.app_role])))
;

ALTER TABLE public.pay_periods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage payroll calculations"
	ON public.payroll_calculations
	FOR ALL
	TO authenticated
	USING ((SELECT public.has_any_role(ARRAY['admin'::public.app_role])))
;

ALTER TABLE public.payroll_calculations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins may delete any profile"
	ON public.profiles
	FOR DELETE
	TO authenticated
	USING ((SELECT public.has_role('admin'::public.app_role)))
;

CREATE POLICY "Admins or the owner may create a profile"
	ON public.profiles
	FOR INSERT
	TO authenticated
	WITH CHECK ((
		(SELECT auth.uid()) = public.profiles.id
		OR (SELECT public.has_role('admin'::public.app_role))
	))
;

CREATE POLICY "Users with role may view a profile"
	ON public.profiles
	FOR SELECT
	TO authenticated
	USING ((SELECT auth.uid()) = public.profiles.id
	OR (SELECT public.has_any_role(ARRAY['admin'::public.app_role, 'manager'::public.app_role, 'ccm'::public.app_role, 'crm'::public.app_role])))
;

CREATE POLICY "Admins or the owner may update a profile"
	ON public.profiles
	FOR UPDATE
	TO authenticated
	USING ((
		(SELECT auth.uid()) = public.profiles.id
		OR (SELECT public.has_role('admin'::public.app_role))
	))
;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins and managers or the owner can view time corrections"
	ON public.time_corrections
	FOR SELECT
	TO authenticated
	USING ((
			(SELECT public.has_any_role(ARRAY['admin'::public.app_role, 'manager'::public.app_role]))
			OR (SELECT auth.uid()) = user_id
	))
;

CREATE POLICY "Admins and managers can update time corrections"
	ON public.time_corrections
	FOR UPDATE
	TO authenticated
	USING ((SELECT public.has_any_role(ARRAY['admin'::public.app_role, 'manager'::public.app_role])))
;

CREATE POLICY "Users can create their own time corrections"
	ON public.time_corrections
	FOR INSERT
	TO authenticated
	WITH CHECK (((SELECT auth.uid()) = user_id))
;

ALTER TABLE public.time_off_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins, managers, and the owner may delete time entries"
	ON public.time_entries
	FOR DELETE
	TO authenticated
	USING ((
		(SELECT auth.uid()) = user_id
		OR (SELECT public.has_any_role(ARRAY['admin'::public.app_role, 'manager'::public.app_role]))
	))
;

CREATE POLICY "Admins, managers, and the owner may create new entries"
	ON public.time_entries
	FOR INSERT
	TO authenticated
	WITH CHECK ((
		(SELECT auth.uid()) = user_id
		OR (SELECT public.has_any_role(ARRAY['admin'::public.app_role, 'manager'::public.app_role]))
	))
;

CREATE POLICY "Admins, managers, and the owner may see entries"
	ON public.time_entries
	FOR SELECT
	TO authenticated
	USING ((
		(SELECT auth.uid()) = user_id
		OR (SELECT public.has_any_role(ARRAY['admin'::public.app_role, 'manager'::public.app_role]))
	))
;

CREATE POLICY "Admins, managers, and the owner may update entries"
	ON public.time_entries
	FOR UPDATE
	TO authenticated
	USING ((
		(SELECT auth.uid()) = user_id
		OR (SELECT public.has_any_role(ARRAY['admin'::public.app_role, 'manager'::public.app_role]))
	))
;

ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "User can view all time off requests"
	ON public.time_off_requests
	FOR SELECT
	TO authenticated
	USING (true)
;

CREATE POLICY "Admins and user can update time off requests"
	ON public.time_off_requests
	FOR UPDATE
	TO authenticated
	USING ((
		(SELECT public.has_any_role(ARRAY['admin'::public.app_role]))
		OR ((SELECT auth.uid()) = time_off_requests.user_id AND time_off_requests.status = 'pending'::text)
	))
;

CREATE POLICY "Users can create their own time off requests"
	ON public.time_off_requests
	FOR INSERT
	TO authenticated
	WITH CHECK (((SELECT auth.uid()) = user_id))
;

CREATE POLICY "Users can delete their own time off requests"
	ON public.time_off_requests
	FOR DELETE
	TO authenticated
	USING ((
		(SELECT auth.uid()) = user_id
	))
;

ALTER TABLE public.time_off_requests ENABLE ROW LEVEL SECURITY;
INSERT INTO auth.users (
	instance_id,
	id,
	aud,
	role,
	email,
	encrypted_password,
	email_confirmed_at,
	recovery_sent_at,
	last_sign_in_at,
	raw_app_meta_data,
	raw_user_meta_data,
	created_at,
	updated_at,
	confirmation_token,
	email_change,
	email_change_token_new,
	recovery_token
) VALUES
	(
		'00000000-0000-0000-0000-000000000000',
		extensions.uuid_generate_v4(),
		'authenticated',
		'authenticated',
		'autoapprover@tlcops.com',
		extensions.crypt('password123', extensions.gen_salt('bf')),
		current_timestamp,
		current_timestamp,
		current_timestamp,
		'{"provider":"email","providers":["email"]}',
		'{"role":"admin"}',
		current_timestamp,
		current_timestamp,
		'',
		'',
		'',
		''
	)

;
