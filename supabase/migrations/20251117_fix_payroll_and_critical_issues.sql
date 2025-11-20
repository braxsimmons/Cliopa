-- Migration: Fix Critical Payroll Calculation and Database Issues
-- Date: 2025-11-17
-- Description: Implements correct weekly overtime calculation with pay period boundary handling
--              and fixes all critical database constraint and function issues

-- ============================================================================
-- PART 1: FIX STATUS CONSTRAINT (Critical Issue #1)
-- ============================================================================
-- Problem: Database only allows 'active', 'completed' but code uses 'auto_ended', 'manual_ended'
-- Solution: Expand constraint to include all valid statuses

ALTER TABLE time_entries
DROP CONSTRAINT IF EXISTS time_entries_status_check;

ALTER TABLE time_entries
ADD CONSTRAINT time_entries_status_check
CHECK (status = ANY(ARRAY['active', 'completed', 'auto_ended', 'manual_ended']));

COMMENT ON CONSTRAINT time_entries_status_check ON time_entries IS
'Allows: active (currently clocked in), completed (manually clocked out), auto_ended (automatically ended by schedule), manual_ended (retroactively entered shift)';


-- ============================================================================
-- PART 2: FIX USER ROLES FUNCTIONS (Critical Issue #4)
-- ============================================================================
-- Problem: Functions reference deleted user_roles table
-- Solution: Update to query profiles.role instead

CREATE OR REPLACE FUNCTION public.get_user_roles(target_user_id uuid DEFAULT auth.uid())
RETURNS app_role[]
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT ARRAY_AGG(role)
  FROM public.profiles
  WHERE id = target_user_id;
$$;

CREATE OR REPLACE FUNCTION public.has_any_role(target_roles app_role[], target_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = target_user_id
      AND role = ANY(target_roles)
  );
$$;

CREATE OR REPLACE FUNCTION public.has_role(target_role app_role, target_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = target_user_id
      AND role = target_role
  );
$$;


-- ============================================================================
-- PART 3: FIX APPROVE TIME OFF REQUEST (Critical Issue #5)
-- ============================================================================
-- Problem: Function tries to update deleted pto_balance and uto_balance columns
-- Solution: Remove balance updates (now calculated dynamically via get_time_off_data)

CREATE OR REPLACE FUNCTION public.approve_time_off_request(request_id uuid, approver_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  request_record RECORD;
  user_profile RECORD;
BEGIN
  -- Get the request details
  SELECT * INTO request_record
  FROM public.time_off_requests
  WHERE id = request_id AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found or already processed';
  END IF;

  -- Get user profile for hourly rate
  SELECT * INTO user_profile
  FROM public.profiles
  WHERE id = request_record.user_id;

  -- Update the request status
  UPDATE public.time_off_requests
  SET
    status = 'approved',
    approved_by = approver_id,
    approved_at = now(),
    updated_at = now()
  WHERE id = request_id;

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

  -- NOTE: Balance deduction removed - balances are now calculated dynamically
  -- via get_time_off_data() based on start_date, rules, and approved_time_off history

  RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION public.approve_time_off_request(uuid, uuid) IS
'Approves time off request and creates approved_time_off record. Balance calculation is now dynamic via get_time_off_data().';


-- ============================================================================
-- PART 4: CORRECTED PAYROLL CALCULATION (Critical Issues #2 & #3)
-- ============================================================================
-- Problem:
--   1. Overtime calculated per-shift instead of per-week
--   2. Holiday pay double-counts worked holidays
--   3. Doesn't handle overtime across pay period boundaries
--
-- Solution: Implement proper weekly overtime calculation per FLSA with:
--   - Full week identification for pay period start
--   - Prior week overtime carryover
--   - Weekly grouping within pay period
--   - Proportional daily overtime allocation

CREATE OR REPLACE FUNCTION public.calculate_payroll_for_period(pay_period_id_param uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  period_record RECORD;
  user_record RECORD;

  -- Pay period boundaries
  pay_period_start DATE;
  pay_period_end DATE;

  -- Prior week (for overtime carryover)
  prior_week_start DATE;
  prior_week_end DATE;
  prior_week_ot NUMERIC := 0;

  -- Calculation variables
  total_hours_in_period NUMERIC := 0;
  regular_hours_calc NUMERIC := 0;
  overtime_hours_calc NUMERIC := 0;
  holiday_hours_calc NUMERIC := 0;
  pto_hours_calc NUMERIC := 0;

  -- Pay calculation
  regular_pay_calc NUMERIC := 0;
  overtime_pay_calc NUMERIC := 0;
  holiday_pay_calc NUMERIC := 0;
  pto_pay_calc NUMERIC := 0;
  total_gross_calc NUMERIC := 0;
BEGIN
  -- Get pay period details
  SELECT * INTO period_record FROM public.pay_periods WHERE id = pay_period_id_param;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pay period not found';
  END IF;

  pay_period_start := period_record.start_date;
  pay_period_end := period_record.end_date;

  -- Calculate the full week containing the pay period start (Sunday = 0)
  -- This is critical for capturing overtime that crosses pay period boundaries
  prior_week_start := pay_period_start - ((EXTRACT(DOW FROM pay_period_start)::INTEGER) || ' days')::INTERVAL;
  prior_week_end := prior_week_start + INTERVAL '6 days';

  -- Loop through all users with profiles
  FOR user_record IN
    SELECT id, hourly_rate, first_name, last_name, email
    FROM public.profiles
    ORDER BY last_name, first_name
  LOOP
    -- Reset calculation variables for this user
    total_hours_in_period := 0;
    regular_hours_calc := 0;
    overtime_hours_calc := 0;
    prior_week_ot := 0;

    -- ========================================================================
    -- STEP 1: Calculate overtime from the PRIOR FULL WEEK
    -- (Week containing pay_period_start, even if it extends before the period)
    -- ========================================================================
    WITH prior_week_hours AS (
      SELECT
        DATE(start_time) AS work_date,
        SUM(total_hours) AS day_hours
      FROM public.time_entries
      WHERE user_id = user_record.id
        AND DATE(start_time) >= prior_week_start
        AND DATE(start_time) <= prior_week_end
        AND status IN ('completed', 'auto_ended', 'manual_ended')
      GROUP BY DATE(start_time)
    )
    SELECT
      GREATEST(SUM(day_hours) - 40, 0) INTO prior_week_ot
    FROM prior_week_hours;

    -- ========================================================================
    -- STEP 2: Calculate hours INSIDE the pay period with proper weekly OT
    -- ========================================================================
    WITH
    -- Get all time entries in the pay period with week grouping
    period_entries AS (
      SELECT
        id,
        user_id,
        DATE(start_time) AS work_date,
        DATE_TRUNC('week', start_time)::DATE AS week_start, -- Sunday of each week
        total_hours,
        status
      FROM public.time_entries
      WHERE user_id = user_record.id
        AND DATE(start_time) >= pay_period_start
        AND DATE(start_time) <= pay_period_end
        AND status IN ('completed', 'auto_ended', 'manual_ended')
    ),

    -- Calculate total hours per week
    weekly_totals AS (
      SELECT
        week_start,
        SUM(total_hours) AS week_total_hours
      FROM period_entries
      GROUP BY week_start
    ),

    -- Calculate daily hours with week context
    daily_hours AS (
      SELECT
        pe.work_date,
        pe.week_start,
        SUM(pe.total_hours) AS day_total_hours,
        wt.week_total_hours
      FROM period_entries pe
      JOIN weekly_totals wt ON pe.week_start = wt.week_start
      GROUP BY pe.work_date, pe.week_start, wt.week_total_hours
    ),

    -- Calculate overtime allocation per day
    daily_breakdown AS (
      SELECT
        work_date,
        day_total_hours,
        week_total_hours,
        CASE
          -- If week total > 40, this day gets proportional OT
          WHEN week_total_hours > 40 THEN
            (day_total_hours / week_total_hours) * (week_total_hours - 40)
          ELSE
            0
        END AS day_overtime_hours,
        CASE
          -- Regular hours = total hours - overtime portion
          WHEN week_total_hours > 40 THEN
            day_total_hours - ((day_total_hours / week_total_hours) * (week_total_hours - 40))
          ELSE
            day_total_hours
        END AS day_regular_hours
      FROM daily_hours
    )

    -- Sum up all regular and OT hours for the period
    SELECT
      COALESCE(SUM(day_total_hours), 0),
      COALESCE(SUM(day_regular_hours), 0),
      COALESCE(SUM(day_overtime_hours), 0)
    INTO
      total_hours_in_period,
      regular_hours_calc,
      overtime_hours_calc
    FROM daily_breakdown;

    -- Add prior week overtime to this period's OT
    overtime_hours_calc := overtime_hours_calc + COALESCE(prior_week_ot, 0);

    -- ========================================================================
    -- STEP 3: Calculate HOLIDAY hours (employees get paid even if not working)
    -- Excludes days where employee actually worked (to avoid double-counting)
    -- ========================================================================
    WITH worked_dates AS (
      SELECT DISTINCT DATE(start_time) AS work_date
      FROM public.time_entries
      WHERE user_id = user_record.id
        AND DATE(start_time) >= pay_period_start
        AND DATE(start_time) <= pay_period_end
        AND status IN ('completed', 'auto_ended', 'manual_ended')
    )
    SELECT COALESCE(COUNT(*) * 8, 0) INTO holiday_hours_calc
    FROM public.holidays h
    WHERE h.holiday_date >= pay_period_start
      AND h.holiday_date <= pay_period_end
      AND NOT EXISTS (
        SELECT 1 FROM worked_dates wd
        WHERE wd.work_date = h.holiday_date
      );

    -- ========================================================================
    -- STEP 4: Calculate PTO hours (8 hours per day of approved PTO)
    -- UTO is NOT paid, so we exclude request_type = 'UTO'
    -- ========================================================================
    WITH pto_days AS (
      SELECT
        user_id,
        request_type,
        -- Generate series of dates for multi-day PTO
        generate_series(start_date, end_date, '1 day'::INTERVAL)::DATE AS pto_date
      FROM public.approved_time_off
      WHERE user_id = user_record.id
        AND request_type = 'PTO'
        AND end_date >= pay_period_start
        AND start_date <= pay_period_end
    )
    SELECT COALESCE(COUNT(*) * 8, 0) INTO pto_hours_calc
    FROM pto_days
    WHERE pto_date >= pay_period_start
      AND pto_date <= pay_period_end;

    -- ========================================================================
    -- STEP 5: Calculate pay amounts
    -- ========================================================================
    regular_pay_calc := regular_hours_calc * user_record.hourly_rate;
    overtime_pay_calc := overtime_hours_calc * user_record.hourly_rate * 1.5; -- Time and a half
    holiday_pay_calc := holiday_hours_calc * user_record.hourly_rate;
    pto_pay_calc := pto_hours_calc * user_record.hourly_rate;
    total_gross_calc := regular_pay_calc + overtime_pay_calc + holiday_pay_calc + pto_pay_calc;

    -- ========================================================================
    -- STEP 6: Insert or update payroll calculation
    -- ========================================================================
    INSERT INTO public.payroll_calculations (
      user_id,
      pay_period_id,
      regular_hours,
      overtime_hours,
      holiday_hours,
      pto_hours,
      hourly_rate,
      regular_pay,
      overtime_pay,
      holiday_pay,
      pto_pay,
      total_gross_pay
    ) VALUES (
      user_record.id,
      pay_period_id_param,
      regular_hours_calc,
      overtime_hours_calc,
      holiday_hours_calc,
      pto_hours_calc,
      user_record.hourly_rate,
      regular_pay_calc,
      overtime_pay_calc,
      holiday_pay_calc,
      pto_pay_calc,
      total_gross_calc
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

  -- Update pay period status to processing
  UPDATE public.pay_periods
  SET status = 'processing', updated_at = now()
  WHERE id = pay_period_id_param;

END;
$$;

COMMENT ON FUNCTION public.calculate_payroll_for_period(uuid) IS
'Calculates payroll with proper FLSA weekly overtime rules:
1. Identifies full week containing pay period start for OT carryover
2. Calculates weekly OT within pay period (>40 hrs/week)
3. Distributes OT proportionally across days
4. Holiday pay only for non-worked holidays (avoids double-counting)
5. PTO paid at 8 hrs/day, UTO unpaid
6. OT rate = 1.5x base hourly rate';


-- ============================================================================
-- PART 5: ADD HELPFUL VIEWS FOR PAYROLL DEBUGGING
-- ============================================================================

-- View to see detailed weekly breakdown for a user in a pay period
CREATE OR REPLACE VIEW payroll_weekly_breakdown AS
WITH period_entries AS (
  SELECT
    te.user_id,
    pp.id AS pay_period_id,
    pp.start_date AS period_start,
    pp.end_date AS period_end,
    DATE(te.start_time) AS work_date,
    DATE_TRUNC('week', te.start_time)::DATE AS week_start,
    te.total_hours,
    te.status
  FROM public.time_entries te
  CROSS JOIN public.pay_periods pp
  WHERE DATE(te.start_time) >= pp.start_date
    AND DATE(te.start_time) <= pp.end_date
    AND te.status IN ('completed', 'auto_ended', 'manual_ended')
)
SELECT
  user_id,
  pay_period_id,
  period_start,
  period_end,
  week_start,
  week_start + INTERVAL '6 days' AS week_end,
  COUNT(DISTINCT work_date) AS days_worked,
  SUM(total_hours) AS total_week_hours,
  GREATEST(SUM(total_hours) - 40, 0) AS week_overtime_hours,
  LEAST(SUM(total_hours), 40) AS week_regular_hours
FROM period_entries
GROUP BY user_id, pay_period_id, period_start, period_end, week_start
ORDER BY user_id, week_start;

COMMENT ON VIEW payroll_weekly_breakdown IS
'Shows weekly hour totals and OT calculation for each user in each pay period. Useful for debugging payroll calculations.';


-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Verification queries (run these to confirm fixes):
--
-- 1. Check status constraint:
--    SELECT constraint_name, check_clause
--    FROM information_schema.check_constraints
--    WHERE constraint_name = 'time_entries_status_check';
--
-- 2. Test get_user_roles function:
--    SELECT get_user_roles('50b44e78-86c6-460e-a69c-8fe26b38d2ed');
--
-- 3. View payroll weekly breakdown:
--    SELECT * FROM payroll_weekly_breakdown
--    WHERE user_id = '50b44e78-86c6-460e-a69c-8fe26b38d2ed'
--    LIMIT 10;
