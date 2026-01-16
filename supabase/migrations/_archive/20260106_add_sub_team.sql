-- Migration: Add sub_team enum and column to profiles
-- Date: 2026-01-06
-- Description: Aligns database with tlc-time-stable production version

-- ============================================================================
-- STEP 1: Create sub_team enum type
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sub_team') THEN
        CREATE TYPE public.sub_team AS ENUM (
            'Cascade',
            'Denali',
            'DSS/NSS',
            'Everest',
            'Fuji',
            'Kilimanjaro',
            'K2',
            'Matterhorn'
        );
        RAISE NOTICE 'Created sub_team enum type';
    ELSE
        RAISE NOTICE 'sub_team enum already exists';
    END IF;
END $$;

-- ============================================================================
-- STEP 2: Add sub_team column to profiles table
-- ============================================================================

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS sub_team public.sub_team NULL;

-- ============================================================================
-- STEP 3: Update get_profile_with_time_off_balance function to include sub_team
-- ============================================================================

-- Drop existing function first since return type is changing
DROP FUNCTION IF EXISTS public.get_profile_with_time_off_balance(uuid);

CREATE OR REPLACE FUNCTION public.get_profile_with_time_off_balance(
    target_user_id uuid
)
RETURNS TABLE(
    id uuid,
    email text,
    first_name text,
    last_name text,
    role text,
    hourly_rate numeric,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    start_date date,
    birthday date,
    team text,
    sub_team text,
    uto_name text,
    max_uto numeric,
    pending_uto_request numeric,
    available_uto numeric,
    pto_name text,
    max_pto numeric,
    pending_pto_request numeric,
    available_pto numeric,
    time_off_start_date_pto timestamp with time zone,
    time_off_end_date_pto timestamp with time zone,
    time_off_start_date_uto timestamp with time zone,
    time_off_end_date_uto timestamp with time zone,
    uto_id uuid,
    pto_id uuid,
    employment_type text
)
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
            p.employment_type,
            p.sub_team::text as sub_team
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
        pc.sub_team,
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
$function$;

-- ============================================================================
-- STEP 4: Fix get_weekly_time_off_request to handle requests spanning weeks
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_weekly_time_off_request(
    target_user_id uuid,
    target_weeks date[]
)
RETURNS TABLE(
    request_type text,
    week_start_date date,
    start_date date,
    end_date date
)
LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    tor.request_type,
    DATE_TRUNC('week', tor.start_date)::date as week_start_date,
    tor.start_date,
    tor.end_date
  FROM time_off_requests tor
  WHERE tor.user_id = target_user_id
    AND (DATE_TRUNC('week', tor.start_date)::date = ANY(target_weeks)
         OR DATE_TRUNC('week', tor.end_date)::date = ANY(target_weeks))
    AND tor.status = 'approved';
END;
$function$;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
DECLARE
    col_exists BOOLEAN;
    type_exists BOOLEAN;
BEGIN
    -- Check if column exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'profiles'
        AND column_name = 'sub_team'
    ) INTO col_exists;

    -- Check if type exists
    SELECT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'sub_team'
    ) INTO type_exists;

    IF col_exists AND type_exists THEN
        RAISE NOTICE 'SUCCESS: sub_team migration completed successfully!';
        RAISE NOTICE '  - sub_team enum type: EXISTS';
        RAISE NOTICE '  - profiles.sub_team column: EXISTS';
    ELSE
        RAISE WARNING 'Migration may not have completed correctly';
        RAISE NOTICE '  - sub_team enum type: %', CASE WHEN type_exists THEN 'EXISTS' ELSE 'MISSING' END;
        RAISE NOTICE '  - profiles.sub_team column: %', CASE WHEN col_exists THEN 'EXISTS' ELSE 'MISSING' END;
    END IF;
END $$;
