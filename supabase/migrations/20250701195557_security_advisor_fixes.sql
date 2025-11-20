set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.approve_time_correction(correction_id uuid, approver_id uuid, notes text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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

	-- Update the time entry with the corrected end time
	UPDATE public.time_entries
	SET
		end_time = correction_record.requested_end_time,
		total_hours = EXTRACT(EPOCH FROM (correction_record.requested_end_time - start_time)) / 3600.0,
		status = 'completed',
		updated_at = NOW()
	WHERE
		id = correction_record.time_entry_id
	;

	-- Update the correction status
	UPDATE public.time_corrections
	SET
		status = 'approved',
		approved_by = approver_id,
		approved_at = NOW(),
		approval_notes = notes,
		updated_at = NOW()
	WHERE
		id = correction_id
	;

	RETURN TRUE;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.approve_time_off_request(request_id uuid, approver_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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

	-- Deduct from appropriate balance
	IF request_record.request_type = 'PTO' THEN
		UPDATE public.profiles
		SET
			pto_balance = pto_balance - request_record.days_requested
		WHERE
			id = request_record.user_id
		;
	ELSIF request_record.request_type = 'UTO' THEN
		UPDATE public.profiles
		SET
			uto_balance = uto_balance - request_record.days_requested
		WHERE
			id = request_record.user_id
		;
	END IF;

	RETURN TRUE;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.auto_end_shift(user_id_param uuid, time_entry_id_param uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.calculate_payroll_for_period(
	pay_period_id_param uuid
) RETURNS void
    LANGUAGE plpgsql
	SET search_path = ''
	SECURITY DEFINER
    AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.calculate_total_hours()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
	IF NEW.end_time IS NOT NULL
		AND NEW.start_time IS NOT NULL THEN
		NEW.total_hours = EXTRACT(EPOCH FROM (NEW.end_time - NEW.start_time)) / 3600.0;
		NEW.status = 'completed';
	END IF;
	NEW.updated_at = NOW();
	RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.deny_time_off_request(request_id uuid, approver_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.generate_pay_periods_for_year(
	year_param integer
) RETURNS void
    LANGUAGE plpgsql
	SET search_path = ''
	SECURITY DEFINER
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.get_user_roles(target_user_id uuid DEFAULT auth.uid())
 RETURNS public.app_role[]
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
	SELECT ARRAY_AGG(role)
	FROM public.user_roles
	WHERE user_id = target_user_id;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
	INSERT INTO public.profiles (
		id, email, first_name, last_name
	)
	VALUES (
		NEW.id,
		NEW.email,
		COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
		COALESCE(NEW.raw_user_meta_data->>'last_name', '')
	);
	RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.has_any_role(target_roles public.app_role[], target_user_id uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
	SELECT EXISTS (
		SELECT 1
		FROM public.user_roles
		WHERE
			user_id = target_user_id
			AND role = ANY(target_roles)
	);
$function$
;

CREATE OR REPLACE FUNCTION public.has_role(target_role public.app_role, target_user_id uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
	SELECT EXISTS (
		SELECT 1
		FROM public.user_roles
		WHERE
			user_id = target_user_id
			AND role = target_role
	);
$function$
;

CREATE OR REPLACE FUNCTION public.reset_quarterly_uto_balances()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
	UPDATE public.profiles
	SET uto_balance = 3.00;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_balances_on_time_off()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
	IF NEW.type = 'PTO' THEN
		UPDATE public.profiles
		SET pto_balance = pto_balance - NEW.days_taken
		WHERE id = NEW.user_id;
	ELSIF NEW.type = 'UTO' THEN
		UPDATE public.profiles
		SET uto_balance = uto_balance - NEW.days_taken
		WHERE id = NEW.user_id;
	END IF;
	RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_employee_shifts_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
	NEW.updated_at = NOW();
	RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_pto_balance_on_time_off()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
	IF NEW.time_off_type = 'PTO' THEN
		UPDATE public.profiles
		SET pto_balance = pto_balance - NEW.days_taken
		WHERE id = NEW.user_id;
	END IF;
	RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
	NEW.updated_at = NOW();
	RETURN NEW;
END;
$function$
;
