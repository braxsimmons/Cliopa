-- ============================================================================
-- DATA MIGRATION SCRIPT: tlc-time-stable -> Cliopa
-- ============================================================================
-- This script helps migrate data from the production tlc-time-stable database
-- to the new Cliopa database while preserving all relationships.
--
-- IMPORTANT: Run this AFTER all schema migrations have been applied.
-- ============================================================================

-- ============================================================================
-- PRE-MIGRATION: Verify Schema Compatibility
-- ============================================================================

DO $$
DECLARE
    missing_columns TEXT := '';
BEGIN
    -- Check profiles has required columns
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'profiles' AND column_name = 'sub_team'
    ) THEN
        missing_columns := missing_columns || 'profiles.sub_team, ';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'profiles' AND column_name = 'employment_type'
    ) THEN
        missing_columns := missing_columns || 'profiles.employment_type, ';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'profiles' AND column_name = 'pto_rule_advance_at'
    ) THEN
        missing_columns := missing_columns || 'profiles.pto_rule_advance_at, ';
    END IF;

    IF missing_columns != '' THEN
        RAISE EXCEPTION 'Missing columns: %. Run 20260106_add_sub_team.sql first!',
            RTRIM(missing_columns, ', ');
    END IF;

    RAISE NOTICE 'Schema verification passed!';
END $$;

-- ============================================================================
-- STEP 1: Export Commands (Run on SOURCE database)
-- ============================================================================
-- Copy these to your source database to export data as CSV

/*
-- 1a. Export time_off_rules (do this first - other tables reference it)
\copy (SELECT * FROM time_off_rules ORDER BY created_at) TO '/tmp/time_off_rules.csv' WITH CSV HEADER;

-- 1b. Export profiles
\copy (
    SELECT id, email, first_name, last_name, hourly_rate, role,
           start_date, birthday, team, sub_team, employment_type,
           pto_rule, uto_rule, pto_rule_advance_at, created_at, updated_at
    FROM profiles
    ORDER BY created_at
) TO '/tmp/profiles.csv' WITH CSV HEADER;

-- 1c. Export employee_shifts
\copy (SELECT * FROM employee_shifts ORDER BY user_id, day_of_week) TO '/tmp/employee_shifts.csv' WITH CSV HEADER;

-- 1d. Export time_entries
\copy (SELECT * FROM time_entries ORDER BY created_at) TO '/tmp/time_entries.csv' WITH CSV HEADER;

-- 1e. Export time_off_requests
\copy (SELECT * FROM time_off_requests ORDER BY created_at) TO '/tmp/time_off_requests.csv' WITH CSV HEADER;

-- 1f. Export approved_time_off
\copy (SELECT * FROM approved_time_off ORDER BY created_at) TO '/tmp/approved_time_off.csv' WITH CSV HEADER;

-- 1g. Export time_corrections
\copy (SELECT * FROM time_corrections ORDER BY created_at) TO '/tmp/time_corrections.csv' WITH CSV HEADER;

-- 1h. Export early_clock_attempts
\copy (SELECT * FROM early_clock_attempts ORDER BY created_at) TO '/tmp/early_clock_attempts.csv' WITH CSV HEADER;

-- 1i. Export holidays
\copy (SELECT * FROM holidays ORDER BY holiday_date) TO '/tmp/holidays.csv' WITH CSV HEADER;

-- 1j. Export pay_periods
\copy (SELECT * FROM pay_periods ORDER BY start_date) TO '/tmp/pay_periods.csv' WITH CSV HEADER;

-- 1k. Export payroll_calculations
\copy (SELECT * FROM payroll_calculations ORDER BY created_at) TO '/tmp/payroll_calculations.csv' WITH CSV HEADER;

-- 1l. Export kpis
\copy (SELECT * FROM kpis ORDER BY created_at) TO '/tmp/kpis.csv' WITH CSV HEADER;
*/

-- ============================================================================
-- STEP 2: Import Commands (Run on TARGET/Cliopa database)
-- ============================================================================
-- After copying CSV files to the target server, run these commands

/*
-- IMPORTANT: Disable triggers during import to avoid conflicts
ALTER TABLE profiles DISABLE TRIGGER ALL;
ALTER TABLE employee_shifts DISABLE TRIGGER ALL;
ALTER TABLE time_entries DISABLE TRIGGER ALL;
ALTER TABLE time_off_requests DISABLE TRIGGER ALL;
ALTER TABLE approved_time_off DISABLE TRIGGER ALL;
ALTER TABLE time_corrections DISABLE TRIGGER ALL;
ALTER TABLE early_clock_attempts DISABLE TRIGGER ALL;

-- 2a. Import time_off_rules first
\copy time_off_rules FROM '/tmp/time_off_rules.csv' WITH CSV HEADER;

-- 2b. Import profiles (users must exist in auth.users first!)
-- NOTE: For profiles, you may need to create auth users first via Supabase Dashboard
-- or use supabase.auth.admin.createUser() API
\copy profiles FROM '/tmp/profiles.csv' WITH CSV HEADER;

-- 2c. Import remaining tables
\copy employee_shifts FROM '/tmp/employee_shifts.csv' WITH CSV HEADER;
\copy time_entries FROM '/tmp/time_entries.csv' WITH CSV HEADER;
\copy time_off_requests FROM '/tmp/time_off_requests.csv' WITH CSV HEADER;
\copy approved_time_off FROM '/tmp/approved_time_off.csv' WITH CSV HEADER;
\copy time_corrections FROM '/tmp/time_corrections.csv' WITH CSV HEADER;
\copy early_clock_attempts FROM '/tmp/early_clock_attempts.csv' WITH CSV HEADER;
\copy holidays FROM '/tmp/holidays.csv' WITH CSV HEADER;
\copy pay_periods FROM '/tmp/pay_periods.csv' WITH CSV HEADER;
\copy payroll_calculations FROM '/tmp/payroll_calculations.csv' WITH CSV HEADER;
\copy kpis FROM '/tmp/kpis.csv' WITH CSV HEADER;

-- Re-enable triggers
ALTER TABLE profiles ENABLE TRIGGER ALL;
ALTER TABLE employee_shifts ENABLE TRIGGER ALL;
ALTER TABLE time_entries ENABLE TRIGGER ALL;
ALTER TABLE time_off_requests ENABLE TRIGGER ALL;
ALTER TABLE approved_time_off ENABLE TRIGGER ALL;
ALTER TABLE time_corrections ENABLE TRIGGER ALL;
ALTER TABLE early_clock_attempts ENABLE TRIGGER ALL;
*/

-- ============================================================================
-- STEP 3: Post-Migration Verification Queries
-- ============================================================================

-- Count records in all tables
SELECT 'profiles' as table_name, COUNT(*) as record_count FROM profiles
UNION ALL SELECT 'employee_shifts', COUNT(*) FROM employee_shifts
UNION ALL SELECT 'time_entries', COUNT(*) FROM time_entries
UNION ALL SELECT 'time_off_requests', COUNT(*) FROM time_off_requests
UNION ALL SELECT 'approved_time_off', COUNT(*) FROM approved_time_off
UNION ALL SELECT 'time_corrections', COUNT(*) FROM time_corrections
UNION ALL SELECT 'early_clock_attempts', COUNT(*) FROM early_clock_attempts
UNION ALL SELECT 'holidays', COUNT(*) FROM holidays
UNION ALL SELECT 'pay_periods', COUNT(*) FROM pay_periods
UNION ALL SELECT 'payroll_calculations', COUNT(*) FROM payroll_calculations
UNION ALL SELECT 'time_off_rules', COUNT(*) FROM time_off_rules
UNION ALL SELECT 'kpis', COUNT(*) FROM kpis
ORDER BY table_name;

-- Verify sub_team distribution
SELECT sub_team, COUNT(*) as count
FROM profiles
GROUP BY sub_team
ORDER BY count DESC;

-- Verify employment_type distribution
SELECT employment_type, COUNT(*) as count
FROM profiles
GROUP BY employment_type
ORDER BY count DESC;

-- Check for orphaned records (foreign key issues)
SELECT 'time_entries with invalid user_id' as issue, COUNT(*) as count
FROM time_entries te
WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = te.user_id)
UNION ALL
SELECT 'employee_shifts with invalid user_id', COUNT(*)
FROM employee_shifts es
WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = es.user_id)
UNION ALL
SELECT 'time_off_requests with invalid user_id', COUNT(*)
FROM time_off_requests tor
WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = tor.user_id);

-- ============================================================================
-- STEP 4: Fix Common Issues
-- ============================================================================

-- Fix NULL employment_type (default to 'Full-Time')
UPDATE profiles
SET employment_type = 'Full-Time'
WHERE employment_type IS NULL OR employment_type = '';

-- Ensure all profiles have team set
UPDATE profiles
SET team = 'bisongreen'
WHERE team IS NULL AND email LIKE '%bisongreen%';

UPDATE profiles
SET team = 'boost'
WHERE team IS NULL AND email LIKE '%boost%';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- After running this script:
-- 1. Test login with a few user accounts
-- 2. Verify time entries display correctly
-- 3. Check PTO/UTO balances are correct
-- 4. Test clock in/out functionality
-- ============================================================================
