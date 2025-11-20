--
-- PostgreSQL database dump
--

-- Dumped from database version 15.8
-- Dumped by pg_dump version 16.9

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: app_role; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.app_role AS ENUM (
    'admin',
    'manager',
    'ccm',
    'crm'
);


ALTER TYPE public.app_role OWNER TO postgres;

--
-- Name: approve_time_correction(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.approve_time_correction(correction_id uuid, approver_id uuid, notes text DEFAULT NULL::text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  correction_record RECORD;
BEGIN
  -- Get the correction details
  SELECT * INTO correction_record
  FROM public.time_corrections
  WHERE id = correction_id AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Correction not found or already processed';
  END IF;

  -- Update the time entry with the corrected end time
  UPDATE public.time_entries
  SET
    end_time = correction_record.requested_end_time,
    total_hours = EXTRACT(EPOCH FROM (correction_record.requested_end_time - start_time)) / 3600.0,
    status = 'completed',
    updated_at = now()
  WHERE id = correction_record.time_entry_id;

  -- Update the correction status
  UPDATE public.time_corrections
  SET
    status = 'approved',
    approved_by = approver_id,
    approved_at = now(),
    approval_notes = notes,
    updated_at = now()
  WHERE id = correction_id;

  RETURN TRUE;
END;
$$;


ALTER FUNCTION public.approve_time_correction(correction_id uuid, approver_id uuid, notes text) OWNER TO postgres;

--
-- Name: approve_time_off_request(uuid, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.approve_time_off_request(request_id uuid, approver_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
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

  -- Deduct from appropriate balance
  IF request_record.request_type = 'PTO' THEN
    UPDATE public.profiles
    SET pto_balance = pto_balance - request_record.days_requested
    WHERE id = request_record.user_id;
  ELSIF request_record.request_type = 'UTO' THEN
    UPDATE public.profiles
    SET uto_balance = uto_balance - request_record.days_requested
    WHERE id = request_record.user_id;
  END IF;

  RETURN TRUE;
END;
$$;


ALTER FUNCTION public.approve_time_off_request(request_id uuid, approver_id uuid) OWNER TO postgres;

--
-- Name: auto_end_shift(uuid, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.auto_end_shift(user_id_param uuid, time_entry_id_param uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  shift_record RECORD;
  end_time TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Get the time entry and calculate end time based on schedule
  SELECT te.*, es.morning_end, es.afternoon_end
  INTO shift_record
  FROM time_entries te
  LEFT JOIN employee_shifts es ON es.user_id = te.user_id
    AND es.day_of_week = EXTRACT(DOW FROM te.start_time)
  WHERE te.id = time_entry_id_param AND te.user_id = user_id_param AND te.status = 'active';

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
  WHERE id = time_entry_id_param;

  RETURN TRUE;
END;
$$;


ALTER FUNCTION public.auto_end_shift(user_id_param uuid, time_entry_id_param uuid) OWNER TO postgres;

--
-- Name: calculate_payroll_for_period(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.calculate_payroll_for_period(pay_period_id_param uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
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


ALTER FUNCTION public.calculate_payroll_for_period(pay_period_id_param uuid) OWNER TO postgres;

--
-- Name: calculate_total_hours(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.calculate_total_hours() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.end_time IS NOT NULL AND NEW.start_time IS NOT NULL THEN
    NEW.total_hours = EXTRACT(EPOCH FROM (NEW.end_time - NEW.start_time)) / 3600.0;
    NEW.status = 'completed';
  END IF;
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.calculate_total_hours() OWNER TO postgres;

--
-- Name: deny_time_off_request(uuid, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.deny_time_off_request(request_id uuid, approver_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  -- Update the request status
  UPDATE public.time_off_requests
  SET
    status = 'denied',
    approved_by = approver_id,
    approved_at = now(),
    updated_at = now()
  WHERE id = request_id AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found or already processed';
  END IF;

  RETURN TRUE;
END;
$$;


ALTER FUNCTION public.deny_time_off_request(request_id uuid, approver_id uuid) OWNER TO postgres;

--
-- Name: generate_pay_periods_for_year(integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.generate_pay_periods_for_year(year_param integer) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
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


ALTER FUNCTION public.generate_pay_periods_for_year(year_param integer) OWNER TO postgres;

--
-- Name: get_user_roles(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_user_roles(target_user_id uuid DEFAULT auth.uid()) RETURNS public.app_role[]
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT ARRAY_AGG(role)
  FROM public.user_roles
  WHERE user_id = target_user_id;
$$;


ALTER FUNCTION public.get_user_roles(target_user_id uuid) OWNER TO postgres;

--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', '')
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.handle_new_user() OWNER TO postgres;

--
-- Name: has_any_role(public.app_role[], uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.has_any_role(target_roles public.app_role[], target_user_id uuid DEFAULT auth.uid()) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = target_user_id AND role = ANY(target_roles)
  );
$$;


ALTER FUNCTION public.has_any_role(target_roles public.app_role[], target_user_id uuid) OWNER TO postgres;

--
-- Name: has_role(public.app_role, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.has_role(target_role public.app_role, target_user_id uuid DEFAULT auth.uid()) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = target_user_id AND role = target_role
  );
$$;


ALTER FUNCTION public.has_role(target_role public.app_role, target_user_id uuid) OWNER TO postgres;

--
-- Name: reset_quarterly_uto_balances(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.reset_quarterly_uto_balances() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  UPDATE public.profiles
  SET uto_balance = 3.00;
END;
$$;


ALTER FUNCTION public.reset_quarterly_uto_balances() OWNER TO postgres;

--
-- Name: update_balances_on_time_off(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_balances_on_time_off() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION public.update_balances_on_time_off() OWNER TO postgres;

--
-- Name: update_employee_shifts_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_employee_shifts_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_employee_shifts_updated_at() OWNER TO postgres;

--
-- Name: update_pto_balance_on_time_off(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_pto_balance_on_time_off() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
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


ALTER FUNCTION public.update_pto_balance_on_time_off() OWNER TO postgres;

--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_updated_at_column() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: approved_time_off; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.approved_time_off (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    request_id uuid,
    start_date date NOT NULL,
    end_date date NOT NULL,
    days_taken numeric NOT NULL,
    request_type text NOT NULL,
    hourly_rate numeric,
    total_pay numeric GENERATED ALWAYS AS (
CASE
    WHEN (request_type = 'PTO'::text) THEN ((days_taken * (8)::numeric) * hourly_rate)
    ELSE (0)::numeric
END) STORED,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT approved_time_off_request_type_check CHECK ((request_type = ANY (ARRAY['PTO'::text, 'UTO'::text])))
);


ALTER TABLE public.approved_time_off OWNER TO postgres;

--
-- Name: early_clock_attempts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.early_clock_attempts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    attempted_time timestamp with time zone DEFAULT now() NOT NULL,
    scheduled_start timestamp with time zone NOT NULL,
    actual_clock_in timestamp with time zone,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT early_clock_attempts_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'completed'::text, 'cancelled'::text])))
);


ALTER TABLE public.early_clock_attempts OWNER TO postgres;

--
-- Name: employee_shifts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.employee_shifts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    day_of_week integer NOT NULL,
    is_working_day boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    morning_start time without time zone,
    morning_end time without time zone,
    afternoon_start time without time zone,
    afternoon_end time without time zone,
    CONSTRAINT employee_shifts_day_of_week_check CHECK (((day_of_week >= 0) AND (day_of_week <= 6)))
);


ALTER TABLE public.employee_shifts OWNER TO postgres;

--
-- Name: holidays; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.holidays (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    holiday_date date NOT NULL,
    holiday_name text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.holidays OWNER TO postgres;

--
-- Name: kpis; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.kpis (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    metric_name text NOT NULL,
    metric_value numeric(10,2) NOT NULL,
    bonus_amount numeric(10,2) DEFAULT 0.00,
    period_start date NOT NULL,
    period_end date NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.kpis OWNER TO postgres;

--
-- Name: pay_periods; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pay_periods (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    period_type text NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT pay_periods_period_type_check CHECK ((period_type = ANY (ARRAY['first_half'::text, 'second_half'::text]))),
    CONSTRAINT pay_periods_status_check CHECK ((status = ANY (ARRAY['open'::text, 'processing'::text, 'closed'::text])))
);


ALTER TABLE public.pay_periods OWNER TO postgres;

--
-- Name: payroll_calculations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.payroll_calculations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    pay_period_id uuid NOT NULL,
    regular_hours numeric DEFAULT 0 NOT NULL,
    overtime_hours numeric DEFAULT 0 NOT NULL,
    holiday_hours numeric DEFAULT 0 NOT NULL,
    pto_hours numeric DEFAULT 0 NOT NULL,
    hourly_rate numeric NOT NULL,
    regular_pay numeric DEFAULT 0 NOT NULL,
    overtime_pay numeric DEFAULT 0 NOT NULL,
    holiday_pay numeric DEFAULT 0 NOT NULL,
    pto_pay numeric DEFAULT 0 NOT NULL,
    total_gross_pay numeric DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.payroll_calculations OWNER TO postgres;

--
-- Name: profiles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    email text NOT NULL,
    first_name text,
    last_name text,
    role text DEFAULT 'agent'::text NOT NULL,
    hourly_rate numeric(10,2) DEFAULT 15.00 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    start_date date,
    birthday date,
    team text,
    pto_balance numeric DEFAULT 0.00,
    uto_balance numeric DEFAULT 3.00,
    CONSTRAINT profiles_role_check CHECK ((role = ANY (ARRAY['agent'::text, 'admin'::text])))
);


ALTER TABLE public.profiles OWNER TO postgres;

--
-- Name: time_corrections; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.time_corrections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    time_entry_id uuid NOT NULL,
    original_end_time timestamp with time zone NOT NULL,
    requested_end_time timestamp with time zone NOT NULL,
    reason text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    approved_by uuid,
    approved_at timestamp with time zone,
    approval_notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT time_corrections_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'denied'::text])))
);


ALTER TABLE public.time_corrections OWNER TO postgres;

--
-- Name: time_entries; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.time_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    start_time timestamp with time zone NOT NULL,
    end_time timestamp with time zone,
    total_hours numeric(10,2),
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT time_entries_status_check CHECK ((status = ANY (ARRAY['active'::text, 'completed'::text])))
);


ALTER TABLE public.time_entries OWNER TO postgres;

--
-- Name: time_off_requests; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.time_off_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    request_type text NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    days_requested numeric NOT NULL,
    reason text,
    status text DEFAULT 'pending'::text NOT NULL,
    approved_by uuid,
    approved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    approval_notes text,
    CONSTRAINT time_off_requests_request_type_check CHECK ((request_type = ANY (ARRAY['PTO'::text, 'UTO'::text]))),
    CONSTRAINT time_off_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'denied'::text])))
);


ALTER TABLE public.time_off_requests OWNER TO postgres;

--
-- Name: time_off_taken; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.time_off_taken (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    request_id uuid,
    type text NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    days_taken numeric NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT time_off_taken_type_check CHECK ((type = ANY (ARRAY['PTO'::text, 'UTO'::text, 'sick'::text, 'personal'::text, 'holiday'::text])))
);


ALTER TABLE public.time_off_taken OWNER TO postgres;

--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    role public.app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.user_roles OWNER TO postgres;

--
-- Name: approved_time_off approved_time_off_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.approved_time_off
    ADD CONSTRAINT approved_time_off_pkey PRIMARY KEY (id);


--
-- Name: early_clock_attempts early_clock_attempts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.early_clock_attempts
    ADD CONSTRAINT early_clock_attempts_pkey PRIMARY KEY (id);


--
-- Name: employee_shifts employee_shifts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee_shifts
    ADD CONSTRAINT employee_shifts_pkey PRIMARY KEY (id);


--
-- Name: employee_shifts employee_shifts_user_id_day_of_week_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee_shifts
    ADD CONSTRAINT employee_shifts_user_id_day_of_week_key UNIQUE (user_id, day_of_week);


--
-- Name: holidays holidays_holiday_date_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.holidays
    ADD CONSTRAINT holidays_holiday_date_key UNIQUE (holiday_date);


--
-- Name: holidays holidays_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.holidays
    ADD CONSTRAINT holidays_pkey PRIMARY KEY (id);


--
-- Name: kpis kpis_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.kpis
    ADD CONSTRAINT kpis_pkey PRIMARY KEY (id);


--
-- Name: pay_periods pay_periods_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pay_periods
    ADD CONSTRAINT pay_periods_pkey PRIMARY KEY (id);


--
-- Name: payroll_calculations payroll_calculations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payroll_calculations
    ADD CONSTRAINT payroll_calculations_pkey PRIMARY KEY (id);


--
-- Name: payroll_calculations payroll_calculations_user_id_pay_period_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payroll_calculations
    ADD CONSTRAINT payroll_calculations_user_id_pay_period_id_key UNIQUE (user_id, pay_period_id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: time_corrections time_corrections_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.time_corrections
    ADD CONSTRAINT time_corrections_pkey PRIMARY KEY (id);


--
-- Name: time_entries time_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.time_entries
    ADD CONSTRAINT time_entries_pkey PRIMARY KEY (id);


--
-- Name: time_off_requests time_off_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.time_off_requests
    ADD CONSTRAINT time_off_requests_pkey PRIMARY KEY (id);


--
-- Name: time_off_taken time_off_taken_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.time_off_taken
    ADD CONSTRAINT time_off_taken_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);


--
-- Name: idx_approved_time_off_user_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_approved_time_off_user_date ON public.approved_time_off USING btree (user_id, start_date, end_date);


--
-- Name: idx_time_off_requests_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_time_off_requests_status ON public.time_off_requests USING btree (status);


--
-- Name: idx_time_off_requests_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_time_off_requests_user_id ON public.time_off_requests USING btree (user_id);


--
-- Name: idx_time_off_taken_request_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_time_off_taken_request_id ON public.time_off_taken USING btree (request_id);


--
-- Name: idx_time_off_taken_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_time_off_taken_user_id ON public.time_off_taken USING btree (user_id);


--
-- Name: time_entries calculate_hours_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER calculate_hours_trigger BEFORE UPDATE ON public.time_entries FOR EACH ROW EXECUTE FUNCTION public.calculate_total_hours();


--
-- Name: employee_shifts employee_shifts_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER employee_shifts_updated_at BEFORE UPDATE ON public.employee_shifts FOR EACH ROW EXECUTE FUNCTION public.update_employee_shifts_updated_at();


--
-- Name: time_off_taken update_balances_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_balances_trigger AFTER INSERT ON public.time_off_taken FOR EACH ROW EXECUTE FUNCTION public.update_balances_on_time_off();


--
-- Name: time_off_taken update_time_off_taken_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_time_off_taken_updated_at BEFORE UPDATE ON public.time_off_taken FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: approved_time_off approved_time_off_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.approved_time_off
    ADD CONSTRAINT approved_time_off_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.time_off_requests(id) ON DELETE CASCADE;


--
-- Name: employee_shifts employee_shifts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee_shifts
    ADD CONSTRAINT employee_shifts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: kpis kpis_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.kpis
    ADD CONSTRAINT kpis_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: payroll_calculations payroll_calculations_pay_period_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payroll_calculations
    ADD CONSTRAINT payroll_calculations_pay_period_id_fkey FOREIGN KEY (pay_period_id) REFERENCES public.pay_periods(id);


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: time_entries time_entries_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.time_entries
    ADD CONSTRAINT time_entries_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: time_off_requests time_off_requests_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.time_off_requests
    ADD CONSTRAINT time_off_requests_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES auth.users(id);


--
-- Name: time_off_requests time_off_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.time_off_requests
    ADD CONSTRAINT time_off_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: time_off_taken time_off_taken_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.time_off_taken
    ADD CONSTRAINT time_off_taken_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: time_corrections Admins and managers can update time corrections; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins and managers can update time corrections" ON public.time_corrections FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = ANY (ARRAY['admin'::public.app_role, 'manager'::public.app_role]))))));


--
-- Name: approved_time_off Admins and managers can view all approved time off; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins and managers can view all approved time off" ON public.approved_time_off FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = ANY (ARRAY['admin'::public.app_role, 'manager'::public.app_role]))))));


--
-- Name: time_corrections Admins and managers can view all time corrections; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins and managers can view all time corrections" ON public.time_corrections FOR SELECT USING (((auth.uid() = user_id) OR (EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = ANY (ARRAY['admin'::public.app_role, 'manager'::public.app_role])))))));


--
-- Name: employee_shifts Admins can delete employee shifts; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can delete employee shifts" ON public.employee_shifts FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'admin'::public.app_role)))));


--
-- Name: employee_shifts Admins can insert employee shifts; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can insert employee shifts" ON public.employee_shifts FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'admin'::public.app_role)))));


--
-- Name: time_off_taken Admins can insert time off taken records; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can insert time off taken records" ON public.time_off_taken FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'admin'::public.app_role)))));


--
-- Name: kpis Admins can manage all KPIs; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can manage all KPIs" ON public.kpis USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));


--
-- Name: holidays Admins can manage holidays; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can manage holidays" ON public.holidays USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'admin'::public.app_role)))));


--
-- Name: pay_periods Admins can manage pay periods; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can manage pay periods" ON public.pay_periods USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'admin'::public.app_role)))));


--
-- Name: payroll_calculations Admins can manage payroll calculations; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can manage payroll calculations" ON public.payroll_calculations USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'admin'::public.app_role)))));


--
-- Name: time_off_requests Admins can update all time off requests; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can update all time off requests" ON public.time_off_requests FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'admin'::public.app_role)))));


--
-- Name: employee_shifts Admins can update employee shifts; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can update employee shifts" ON public.employee_shifts FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'admin'::public.app_role)))));


--
-- Name: time_off_taken Admins can update time off taken records; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can update time off taken records" ON public.time_off_taken FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'admin'::public.app_role)))));


--
-- Name: time_entries Admins can view all time entries; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can view all time entries" ON public.time_entries USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));


--
-- Name: time_off_requests Admins can view all time off requests; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can view all time off requests" ON public.time_off_requests FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'admin'::public.app_role)))));


--
-- Name: time_off_taken Admins can view all time off taken records; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can view all time off taken records" ON public.time_off_taken FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'admin'::public.app_role)))));


--
-- Name: approved_time_off Only admins and managers can insert approved time off; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Only admins and managers can insert approved time off" ON public.approved_time_off FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = ANY (ARRAY['admin'::public.app_role, 'manager'::public.app_role]))))));


--
-- Name: early_clock_attempts Users can create their own early clock attempts; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can create their own early clock attempts" ON public.early_clock_attempts FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: time_corrections Users can create their own time corrections; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can create their own time corrections" ON public.time_corrections FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: time_entries Users can create their own time entries; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can create their own time entries" ON public.time_entries FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: time_off_requests Users can create their own time off requests; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can create their own time off requests" ON public.time_off_requests FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: time_entries Users can delete their own time entries; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can delete their own time entries" ON public.time_entries FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: early_clock_attempts Users can update their own early clock attempts; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update their own early clock attempts" ON public.early_clock_attempts FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: time_off_requests Users can update their own pending requests; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update their own pending requests" ON public.time_off_requests FOR UPDATE USING (((auth.uid() = user_id) AND (status = 'pending'::text)));


--
-- Name: employee_shifts Users can view all employee shifts; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view all employee shifts" ON public.employee_shifts FOR SELECT TO authenticated USING (true);


--
-- Name: kpis Users can view their own KPIs; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view their own KPIs" ON public.kpis FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: approved_time_off Users can view their own approved time off; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view their own approved time off" ON public.approved_time_off FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: early_clock_attempts Users can view their own early clock attempts; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view their own early clock attempts" ON public.early_clock_attempts FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: time_corrections Users can view their own time corrections; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view their own time corrections" ON public.time_corrections FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: time_off_requests Users can view their own time off requests; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view their own time off requests" ON public.time_off_requests FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: time_off_taken Users can view their own time off taken; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view their own time off taken" ON public.time_off_taken FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: approved_time_off; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.approved_time_off ENABLE ROW LEVEL SECURITY;

--
-- Name: early_clock_attempts; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.early_clock_attempts ENABLE ROW LEVEL SECURITY;

--
-- Name: employee_shifts; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.employee_shifts ENABLE ROW LEVEL SECURITY;

--
-- Name: holidays; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;

--
-- Name: kpis; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.kpis ENABLE ROW LEVEL SECURITY;

--
-- Name: kpis kpis_delete_policy; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY kpis_delete_policy ON public.kpis FOR DELETE USING (((auth.uid() = user_id) OR public.has_any_role(ARRAY['admin'::public.app_role, 'manager'::public.app_role])));


--
-- Name: kpis kpis_insert_policy; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY kpis_insert_policy ON public.kpis FOR INSERT WITH CHECK (((auth.uid() = user_id) OR public.has_any_role(ARRAY['admin'::public.app_role, 'manager'::public.app_role])));


--
-- Name: kpis kpis_select_policy; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY kpis_select_policy ON public.kpis FOR SELECT USING (((auth.uid() = user_id) OR public.has_any_role(ARRAY['admin'::public.app_role, 'manager'::public.app_role])));


--
-- Name: kpis kpis_update_policy; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY kpis_update_policy ON public.kpis FOR UPDATE USING (((auth.uid() = user_id) OR public.has_any_role(ARRAY['admin'::public.app_role, 'manager'::public.app_role])));


--
-- Name: pay_periods; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.pay_periods ENABLE ROW LEVEL SECURITY;

--
-- Name: payroll_calculations; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.payroll_calculations ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles profiles_delete_policy; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY profiles_delete_policy ON public.profiles FOR DELETE USING (public.has_role('admin'::public.app_role));


--
-- Name: profiles profiles_insert_policy; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY profiles_insert_policy ON public.profiles FOR INSERT WITH CHECK (((auth.uid() = id) OR public.has_role('admin'::public.app_role)));


--
-- Name: profiles profiles_select_policy; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY profiles_select_policy ON public.profiles FOR SELECT USING (((auth.uid() = id) OR public.has_role('admin'::public.app_role)));


--
-- Name: profiles profiles_update_policy; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY profiles_update_policy ON public.profiles FOR UPDATE USING (((auth.uid() = id) OR public.has_role('admin'::public.app_role)));


--
-- Name: time_corrections; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.time_corrections ENABLE ROW LEVEL SECURITY;

--
-- Name: time_entries; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;

--
-- Name: time_entries time_entries_delete_policy; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY time_entries_delete_policy ON public.time_entries FOR DELETE USING (((auth.uid() = user_id) OR public.has_any_role(ARRAY['admin'::public.app_role, 'manager'::public.app_role])));


--
-- Name: time_entries time_entries_insert_policy; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY time_entries_insert_policy ON public.time_entries FOR INSERT WITH CHECK (((auth.uid() = user_id) OR public.has_any_role(ARRAY['admin'::public.app_role, 'manager'::public.app_role])));


--
-- Name: time_entries time_entries_select_policy; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY time_entries_select_policy ON public.time_entries FOR SELECT USING (((auth.uid() = user_id) OR public.has_any_role(ARRAY['admin'::public.app_role, 'manager'::public.app_role])));


--
-- Name: time_entries time_entries_update_policy; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY time_entries_update_policy ON public.time_entries FOR UPDATE USING (((auth.uid() = user_id) OR public.has_any_role(ARRAY['admin'::public.app_role, 'manager'::public.app_role])));


--
-- Name: time_off_requests; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.time_off_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: time_off_taken; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.time_off_taken ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles user_roles_delete_policy; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY user_roles_delete_policy ON public.user_roles FOR DELETE USING (public.has_role('admin'::public.app_role));


--
-- Name: user_roles user_roles_insert_policy; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY user_roles_insert_policy ON public.user_roles FOR INSERT WITH CHECK (public.has_role('admin'::public.app_role));


--
-- Name: user_roles user_roles_select_policy; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY user_roles_select_policy ON public.user_roles FOR SELECT USING (((auth.uid() = user_id) OR public.has_role('admin'::public.app_role)));


--
-- Name: user_roles user_roles_update_policy; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY user_roles_update_policy ON public.user_roles FOR UPDATE USING (public.has_role('admin'::public.app_role));


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: pg_database_owner
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- Name: FUNCTION approve_time_correction(correction_id uuid, approver_id uuid, notes text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.approve_time_correction(correction_id uuid, approver_id uuid, notes text) TO anon;
GRANT ALL ON FUNCTION public.approve_time_correction(correction_id uuid, approver_id uuid, notes text) TO authenticated;
GRANT ALL ON FUNCTION public.approve_time_correction(correction_id uuid, approver_id uuid, notes text) TO service_role;


--
-- Name: FUNCTION approve_time_off_request(request_id uuid, approver_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.approve_time_off_request(request_id uuid, approver_id uuid) TO anon;
GRANT ALL ON FUNCTION public.approve_time_off_request(request_id uuid, approver_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.approve_time_off_request(request_id uuid, approver_id uuid) TO service_role;


--
-- Name: FUNCTION auto_end_shift(user_id_param uuid, time_entry_id_param uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.auto_end_shift(user_id_param uuid, time_entry_id_param uuid) TO anon;
GRANT ALL ON FUNCTION public.auto_end_shift(user_id_param uuid, time_entry_id_param uuid) TO authenticated;
GRANT ALL ON FUNCTION public.auto_end_shift(user_id_param uuid, time_entry_id_param uuid) TO service_role;


--
-- Name: FUNCTION calculate_payroll_for_period(pay_period_id_param uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.calculate_payroll_for_period(pay_period_id_param uuid) TO anon;
GRANT ALL ON FUNCTION public.calculate_payroll_for_period(pay_period_id_param uuid) TO authenticated;
GRANT ALL ON FUNCTION public.calculate_payroll_for_period(pay_period_id_param uuid) TO service_role;


--
-- Name: FUNCTION calculate_total_hours(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.calculate_total_hours() TO anon;
GRANT ALL ON FUNCTION public.calculate_total_hours() TO authenticated;
GRANT ALL ON FUNCTION public.calculate_total_hours() TO service_role;


--
-- Name: FUNCTION deny_time_off_request(request_id uuid, approver_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.deny_time_off_request(request_id uuid, approver_id uuid) TO anon;
GRANT ALL ON FUNCTION public.deny_time_off_request(request_id uuid, approver_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.deny_time_off_request(request_id uuid, approver_id uuid) TO service_role;


--
-- Name: FUNCTION generate_pay_periods_for_year(year_param integer); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.generate_pay_periods_for_year(year_param integer) TO anon;
GRANT ALL ON FUNCTION public.generate_pay_periods_for_year(year_param integer) TO authenticated;
GRANT ALL ON FUNCTION public.generate_pay_periods_for_year(year_param integer) TO service_role;


--
-- Name: FUNCTION get_user_roles(target_user_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_user_roles(target_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_user_roles(target_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_user_roles(target_user_id uuid) TO service_role;


--
-- Name: FUNCTION handle_new_user(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.handle_new_user() TO anon;
GRANT ALL ON FUNCTION public.handle_new_user() TO authenticated;
GRANT ALL ON FUNCTION public.handle_new_user() TO service_role;


--
-- Name: FUNCTION has_any_role(target_roles public.app_role[], target_user_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.has_any_role(target_roles public.app_role[], target_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.has_any_role(target_roles public.app_role[], target_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.has_any_role(target_roles public.app_role[], target_user_id uuid) TO service_role;


--
-- Name: FUNCTION has_role(target_role public.app_role, target_user_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.has_role(target_role public.app_role, target_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.has_role(target_role public.app_role, target_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.has_role(target_role public.app_role, target_user_id uuid) TO service_role;


--
-- Name: FUNCTION reset_quarterly_uto_balances(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.reset_quarterly_uto_balances() TO anon;
GRANT ALL ON FUNCTION public.reset_quarterly_uto_balances() TO authenticated;
GRANT ALL ON FUNCTION public.reset_quarterly_uto_balances() TO service_role;


--
-- Name: FUNCTION update_balances_on_time_off(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.update_balances_on_time_off() TO anon;
GRANT ALL ON FUNCTION public.update_balances_on_time_off() TO authenticated;
GRANT ALL ON FUNCTION public.update_balances_on_time_off() TO service_role;


--
-- Name: FUNCTION update_employee_shifts_updated_at(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.update_employee_shifts_updated_at() TO anon;
GRANT ALL ON FUNCTION public.update_employee_shifts_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.update_employee_shifts_updated_at() TO service_role;


--
-- Name: FUNCTION update_pto_balance_on_time_off(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.update_pto_balance_on_time_off() TO anon;
GRANT ALL ON FUNCTION public.update_pto_balance_on_time_off() TO authenticated;
GRANT ALL ON FUNCTION public.update_pto_balance_on_time_off() TO service_role;


--
-- Name: FUNCTION update_updated_at_column(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.update_updated_at_column() TO anon;
GRANT ALL ON FUNCTION public.update_updated_at_column() TO authenticated;
GRANT ALL ON FUNCTION public.update_updated_at_column() TO service_role;


--
-- Name: TABLE approved_time_off; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.approved_time_off TO anon;
GRANT ALL ON TABLE public.approved_time_off TO authenticated;
GRANT ALL ON TABLE public.approved_time_off TO service_role;


--
-- Name: TABLE early_clock_attempts; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.early_clock_attempts TO anon;
GRANT ALL ON TABLE public.early_clock_attempts TO authenticated;
GRANT ALL ON TABLE public.early_clock_attempts TO service_role;


--
-- Name: TABLE employee_shifts; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.employee_shifts TO anon;
GRANT ALL ON TABLE public.employee_shifts TO authenticated;
GRANT ALL ON TABLE public.employee_shifts TO service_role;


--
-- Name: TABLE holidays; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.holidays TO anon;
GRANT ALL ON TABLE public.holidays TO authenticated;
GRANT ALL ON TABLE public.holidays TO service_role;


--
-- Name: TABLE kpis; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.kpis TO anon;
GRANT ALL ON TABLE public.kpis TO authenticated;
GRANT ALL ON TABLE public.kpis TO service_role;


--
-- Name: TABLE pay_periods; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.pay_periods TO anon;
GRANT ALL ON TABLE public.pay_periods TO authenticated;
GRANT ALL ON TABLE public.pay_periods TO service_role;


--
-- Name: TABLE payroll_calculations; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.payroll_calculations TO anon;
GRANT ALL ON TABLE public.payroll_calculations TO authenticated;
GRANT ALL ON TABLE public.payroll_calculations TO service_role;


--
-- Name: TABLE profiles; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.profiles TO anon;
GRANT ALL ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;


--
-- Name: TABLE time_corrections; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.time_corrections TO anon;
GRANT ALL ON TABLE public.time_corrections TO authenticated;
GRANT ALL ON TABLE public.time_corrections TO service_role;


--
-- Name: TABLE time_entries; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.time_entries TO anon;
GRANT ALL ON TABLE public.time_entries TO authenticated;
GRANT ALL ON TABLE public.time_entries TO service_role;


--
-- Name: TABLE time_off_requests; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.time_off_requests TO anon;
GRANT ALL ON TABLE public.time_off_requests TO authenticated;
GRANT ALL ON TABLE public.time_off_requests TO service_role;


--
-- Name: TABLE time_off_taken; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.time_off_taken TO anon;
GRANT ALL ON TABLE public.time_off_taken TO authenticated;
GRANT ALL ON TABLE public.time_off_taken TO service_role;


--
-- Name: TABLE user_roles; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.user_roles TO anon;
GRANT ALL ON TABLE public.user_roles TO authenticated;
GRANT ALL ON TABLE public.user_roles TO service_role;
