-- Migration: Fix Critical Payroll Calculation (EXACT METABASE FORMULA)
-- Date: 2025-11-17
-- Description: Implements the exact Metabase SQL formula with proper prior week OT handling
--              Fixes all critical database constraint and function issues

-- ============================================================================
-- PART 1: FIX STATUS CONSTRAINT (Critical Issue #1)
-- ============================================================================

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

  -- Balance deduction removed - balances calculated dynamically via get_time_off_data()

  RETURN TRUE;
END;
$$;


-- ============================================================================
-- PART 4: CORRECTED PAYROLL CALCULATION (EXACT METABASE FORMULA)
-- ============================================================================
-- This matches the Metabase SQL formula exactly:
-- - Finds full week containing pay_period_start
-- - Calculates prior week OT
-- - Calculates current period OT with weekly grouping
-- - Regular hours = Total hours - Current OT - Prior OT (key difference!)
-- - Proportional daily OT allocation

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
  prior_week_total_hours NUMERIC := 0;
  prior_week_ot NUMERIC := 0;

  -- Calculation variables
  pay_period_hours NUMERIC := 0;
  current_period_ot NUMERIC := 0;
  regular_rate_hours NUMERIC := 0;
  total_ot_this_period NUMERIC := 0;

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

  -- ========================================================================
  -- Calculate the full week (Sunday-Saturday) containing pay_period_start
  -- This is critical for capturing overtime that crosses pay period boundaries
  -- ========================================================================
  prior_week_start := DATE_TRUNC('week', pay_period_start)::DATE; -- Sunday
  prior_week_end := prior_week_start + INTERVAL '6 days'; -- Saturday

  -- Loop through all users with profiles
  FOR user_record IN
    SELECT id, hourly_rate, first_name, last_name, email
    FROM public.profiles
    ORDER BY last_name, first_name
  LOOP
    -- Reset calculation variables for this user
    pay_period_hours := 0;
    current_period_ot := 0;
    prior_week_total_hours := 0;
    prior_week_ot := 0;
    regular_rate_hours := 0;

    -- ========================================================================
    -- STEP 1: Calculate FULL WEEK hours and overtime
    -- (Week containing pay_period_start, Sun-Sat)
    -- ========================================================================
    WITH full_week_hours AS (
      SELECT
        DATE(start_time) AS work_date,
        SUM(
          ROUND(
            EXTRACT(EPOCH FROM (end_time - start_time)) / 3600.0,
            2
          )
        ) AS day_hours
      FROM public.time_entries
      WHERE user_id = user_record.id
        AND DATE(start_time) >= prior_week_start
        AND DATE(start_time) <= prior_week_end
        AND status IN ('completed', 'auto_ended', 'manual_ended')
        AND end_time IS NOT NULL
      GROUP BY DATE(start_time)
    )
    SELECT
      COALESCE(SUM(day_hours), 0),
      GREATEST(COALESCE(SUM(day_hours), 0) - 40, 0)
    INTO
      prior_week_total_hours,
      prior_week_ot
    FROM full_week_hours;

    -- ========================================================================
    -- STEP 2: Calculate hours INSIDE the pay period with weekly OT
    -- ========================================================================
    WITH
    -- Get all time entries in pay period with week grouping
    in_period AS (
      SELECT
        DATE(start_time) AS work_date,
        DATE_TRUNC('week', start_time)::DATE AS week_start,
        ROUND(
          EXTRACT(EPOCH FROM (end_time - start_time)) / 3600.0,
          2
        ) AS hours
      FROM public.time_entries
      WHERE user_id = user_record.id
        AND DATE(start_time) >= pay_period_start
        AND DATE(start_time) <= pay_period_end
        AND status IN ('completed', 'auto_ended', 'manual_ended')
        AND end_time IS NOT NULL
    ),

    -- Calculate weekly totals inside pay period
    weekly_totals AS (
      SELECT
        week_start,
        SUM(hours) AS week_hours
      FROM in_period
      GROUP BY week_start
    ),

    -- Split weekly hours into regular and OT
    weekly_split AS (
      SELECT
        week_start,
        LEAST(week_hours, 40.0) AS regular_hours,
        GREATEST(week_hours - 40.0, 0.0) AS overtime_hours
      FROM weekly_totals
    ),

    -- Allocate OT proportionally to each day
    daily_with_ot AS (
      SELECT
        ip.work_date,
        ip.hours AS day_hours,
        CASE
          WHEN (ws.regular_hours + ws.overtime_hours) > 0 THEN
            ws.overtime_hours * (ip.hours / (ws.regular_hours + ws.overtime_hours))
          ELSE 0
        END AS day_ot
      FROM in_period ip
      JOIN weekly_split ws
        ON ws.week_start = ip.week_start
    )

    -- Sum totals for pay period
    SELECT
      COALESCE(SUM(day_hours), 0),
      COALESCE(SUM(day_ot), 0)
    INTO
      pay_period_hours,
      current_period_ot
    FROM daily_with_ot;

    -- ========================================================================
    -- STEP 3: Calculate REGULAR RATE HOURS (EXACT METABASE FORMULA)
    -- This is the KEY: subtract BOTH current OT AND prior week OT
    -- ========================================================================
    regular_rate_hours := pay_period_hours - current_period_ot - prior_week_ot;

    -- Total OT this pay period = current OT + prior week OT
    total_ot_this_period := current_period_ot + prior_week_ot;

    -- ========================================================================
    -- STEP 4: Calculate HOLIDAY hours (employees get paid even if not working)
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
    -- STEP 5: Calculate PTO hours (8 hours per day of approved PTO)
    -- UTO is NOT paid, so we exclude request_type = 'UTO'
    -- ========================================================================
    WITH pto_days AS (
      SELECT
        user_id,
        request_type,
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
    -- STEP 6: Calculate pay amounts
    -- ========================================================================
    regular_pay_calc := regular_rate_hours * user_record.hourly_rate;
    overtime_pay_calc := total_ot_this_period * user_record.hourly_rate * 1.5;
    holiday_pay_calc := holiday_hours_calc * user_record.hourly_rate;
    pto_pay_calc := pto_hours_calc * user_record.hourly_rate;
    total_gross_calc := regular_pay_calc + overtime_pay_calc + holiday_pay_calc + pto_pay_calc;

    -- ========================================================================
    -- STEP 7: Insert or update payroll calculation
    -- Storing all intermediate values for debugging/audit purposes
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
      regular_rate_hours,        -- Regular hours (total - current OT - prior OT)
      total_ot_this_period,      -- Total OT (current + prior week)
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

  -- Update pay period status
  UPDATE public.pay_periods
  SET status = 'processing', updated_at = now()
  WHERE id = pay_period_id_param;

END;
$$;

COMMENT ON FUNCTION public.calculate_payroll_for_period(uuid) IS
'Calculates payroll using exact Metabase formula:
1. Finds full week (Sun-Sat) containing pay period start
2. Calculates prior week total hours and OT (>40 hrs)
3. Groups pay period hours by week and calculates current OT
4. Regular hours = Total hours - Current OT - Prior week OT (prevents double-counting)
5. Total OT = Current period OT + Prior week OT
6. Holiday pay only for non-worked holidays
7. PTO paid at 8 hrs/day, UTO unpaid
8. OT rate = 1.5x base hourly rate';


-- ============================================================================
-- PART 5: DEBUGGING VIEW - Match Metabase Output
-- ============================================================================

CREATE OR REPLACE VIEW payroll_debug_view AS
WITH current_period AS (
  SELECT
    id AS pay_period_id,
    start_date AS pay_period_start,
    end_date AS pay_period_end
  FROM public.pay_periods
  WHERE start_date <= CURRENT_DATE
    AND end_date >= CURRENT_DATE
  LIMIT 1
),

week_context AS (
  SELECT
    cp.*,
    DATE_TRUNC('week', cp.pay_period_start)::DATE AS prior_week_start,
    (DATE_TRUNC('week', cp.pay_period_start)::DATE + INTERVAL '6 days')::DATE AS prior_week_end
  FROM current_period cp
),

-- Hours in full prior week
full_week AS (
  SELECT
    te.user_id,
    SUM(
      ROUND(
        EXTRACT(EPOCH FROM (te.end_time - te.start_time)) / 3600.0,
        2
      )
    ) AS full_week_hours
  FROM public.time_entries te
  CROSS JOIN week_context wc
  WHERE DATE(te.start_time) >= wc.prior_week_start
    AND DATE(te.start_time) <= wc.prior_week_end
    AND te.status IN ('completed', 'auto_ended', 'manual_ended')
    AND te.end_time IS NOT NULL
  GROUP BY te.user_id
),

full_week_ot AS (
  SELECT
    user_id,
    full_week_hours,
    GREATEST(full_week_hours - 40, 0) AS week_prior_overtime
  FROM full_week
),

-- Hours inside pay period
in_period AS (
  SELECT
    te.user_id,
    DATE(te.start_time) AS work_date,
    DATE_TRUNC('week', te.start_time)::DATE AS week_start,
    ROUND(
      EXTRACT(EPOCH FROM (te.end_time - te.start_time)) / 3600.0,
      2
    ) AS hours
  FROM public.time_entries te
  CROSS JOIN current_period cp
  WHERE DATE(te.start_time) >= cp.pay_period_start
    AND DATE(te.start_time) <= cp.pay_period_end
    AND te.status IN ('completed', 'auto_ended', 'manual_ended')
    AND te.end_time IS NOT NULL
),

weekly_totals AS (
  SELECT
    user_id,
    week_start,
    SUM(hours) AS week_hours
  FROM in_period
  GROUP BY user_id, week_start
),

weekly_split AS (
  SELECT
    user_id,
    week_start,
    LEAST(week_hours, 40.0) AS regular_hours,
    GREATEST(week_hours - 40.0, 0.0) AS overtime_hours
  FROM weekly_totals
),

daily_with_ot AS (
  SELECT
    ip.user_id,
    ip.hours AS day_hours,
    CASE
      WHEN (ws.regular_hours + ws.overtime_hours) > 0 THEN
        ws.overtime_hours * (ip.hours / (ws.regular_hours + ws.overtime_hours))
      ELSE 0
    END AS day_ot
  FROM in_period ip
  JOIN weekly_split ws ON ws.user_id = ip.user_id AND ws.week_start = ip.week_start
),

period_summary AS (
  SELECT
    user_id,
    SUM(day_hours) AS pay_period_hours,
    SUM(day_ot) AS current_pay_period_ot
  FROM daily_with_ot
  GROUP BY user_id
)

SELECT
  wc.pay_period_start,
  wc.pay_period_end,
  p.first_name || ' ' || p.last_name AS full_name,
  p.role,
  p.hourly_rate,

  -- Hours breakdown
  ROUND(COALESCE(ps.pay_period_hours, 0), 2) AS pay_period_hours,
  ROUND(COALESCE(ps.current_pay_period_ot, 0), 2) AS current_pay_period_ot,
  ROUND(COALESCE(fw.week_prior_overtime, 0), 2) AS week_prior_overtime,
  ROUND(COALESCE(fw.full_week_hours, 0), 2) AS week_prior_total_hours,

  -- Regular hours (total - current OT - prior OT)
  ROUND(
    COALESCE(ps.pay_period_hours, 0)
    - COALESCE(ps.current_pay_period_ot, 0)
    - COALESCE(fw.week_prior_overtime, 0),
    2
  ) AS regular_rate_hours,

  -- Total OT
  ROUND(
    COALESCE(ps.current_pay_period_ot, 0)
    + COALESCE(fw.week_prior_overtime, 0),
    2
  ) AS total_ot_this_pay_period,

  -- Pay calculations
  ROUND(
    (COALESCE(ps.pay_period_hours, 0)
     - COALESCE(ps.current_pay_period_ot, 0)
     - COALESCE(fw.week_prior_overtime, 0))
    * COALESCE(p.hourly_rate, 25),
    2
  ) AS regular_pay,

  ROUND(
    (COALESCE(ps.current_pay_period_ot, 0)
     + COALESCE(fw.week_prior_overtime, 0))
    * COALESCE(p.hourly_rate, 25) * 1.5,
    2
  ) AS overtime_pay,

  ROUND(
    ((COALESCE(ps.pay_period_hours, 0)
      - COALESCE(ps.current_pay_period_ot, 0)
      - COALESCE(fw.week_prior_overtime, 0))
     * COALESCE(p.hourly_rate, 25))
    +
    ((COALESCE(ps.current_pay_period_ot, 0)
      + COALESCE(fw.week_prior_overtime, 0))
     * COALESCE(p.hourly_rate, 25) * 1.5),
    2
  ) AS total_pay

FROM public.profiles p
LEFT JOIN period_summary ps ON ps.user_id = p.id
LEFT JOIN full_week_ot fw ON fw.user_id = p.id
CROSS JOIN week_context wc
ORDER BY p.last_name, p.first_name;

COMMENT ON VIEW payroll_debug_view IS
'Debugging view that matches Metabase output exactly. Shows current pay period calculations with prior week OT carryover. Use this to verify payroll calculations match Metabase reports.';


-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Verification queries:
--
-- 1. View current period payroll (matches Metabase):
--    SELECT * FROM payroll_debug_view;
--
-- 2. Test calculation for a specific pay period:
--    SELECT calculate_payroll_for_period('pay-period-id');
--    SELECT * FROM payroll_calculations WHERE pay_period_id = 'pay-period-id';
--
-- 3. Compare with Metabase output side-by-side
