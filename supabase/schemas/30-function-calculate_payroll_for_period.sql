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
