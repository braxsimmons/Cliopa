# Cliopa Production Deployment Guide

## Pre-Deployment Checklist

### 1. Database Migrations

Run these SQL migrations on your Supabase project (SQL Editor):

**Core Migrations (already applied if using existing tlc-time database):**
- All migrations in `supabase/migrations/` dated before 2025-11-17

**AI/Audit System Migrations (run in order):**
```sql
-- 1. AI Audit System (calls, report_cards, audit_templates, audit_cache)
-- File: supabase/migrations/20251117_ai_audit_system.sql

-- 2. TLC Audit Templates (27 criteria definitions)
-- File: supabase/migrations/20251118_tlc_audit_templates.sql

-- 3. Call Library
-- File: supabase/migrations/20251128_call_library.sql

-- 4. Auto Call Processing
-- File: supabase/migrations/20251201_auto_call_processing.sql

-- 5. Call Sync Tracking
-- File: supabase/migrations/20251201_call_sync_tracking.sql

-- 6. Add summary URL to calls
-- File: supabase/migrations/20251201_add_summary_url_to_calls.sql

-- 7. Sub-team enum and column (alignment with tlc-time-stable)
-- File: supabase/migrations/20260106_add_sub_team.sql
```

### 2. Verify Migration Success

Run this query in Supabase SQL Editor:
```sql
-- Check all required tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN (
  'profiles', 'time_entries', 'employee_shifts', 'time_off_requests',
  'approved_time_off', 'time_corrections', 'early_clock_attempts',
  'holidays', 'pay_periods', 'payroll_calculations', 'time_off_rules',
  'kpis', 'calls', 'report_cards', 'audit_templates', 'audit_cache'
)
ORDER BY table_name;

-- Should return 16 tables

-- Check profiles has new columns
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'profiles'
AND column_name IN ('sub_team', 'employment_type', 'pto_rule_advance_at');

-- Should return 3 columns

-- Check sub_team enum exists
SELECT typname FROM pg_type WHERE typname = 'sub_team';
```

### 3. Environment Variables

**Required for Frontend (Vercel/.env.local):**
```env
VITE_SUPABASE_URL=https://zkywapiptgpnfkacpyrz.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

**Required for AI Features:**
```env
VITE_GEMINI_API_KEY=your_gemini_api_key  # Get from https://makersuite.google.com/app/apikey
```

**Required for Airflow (if deploying automated call sync):**
```env
# Set these as Airflow Variables, not environment vars
MSSQL_SERVER=your_five9_sql_server
MSSQL_DATABASE=fivenine
MSSQL_USERNAME=your_username
MSSQL_PASSWORD=your_password
SUPABASE_URL=https://zkywapiptgpnfkacpyrz.supabase.co
SUPABASE_SERVICE_KEY=your_service_role_key  # NOT the anon key
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-2.0-flash
SYNC_LOOKBACK_HOURS=24
SYNC_BATCH_SIZE=50
```

---

## Airflow DAG Deployment

### Option A: Docker Compose (Recommended for self-hosted)

```bash
cd airflow
docker-compose up -d
```

Access Airflow UI at http://localhost:8080 (default: airflow/airflow)

### Option B: Cloud Composer (GCP)

1. Create a Cloud Composer environment
2. Upload `dags/call_sync_dag.py` to the DAGs bucket
3. Set Variables in Airflow UI

### Option C: MWAA (AWS)

1. Create MWAA environment
2. Upload DAG to S3 DAGs folder
3. Configure Variables via Secrets Manager

### Airflow Variables to Set

In Airflow UI > Admin > Variables, add:
- `MSSQL_SERVER`
- `MSSQL_DATABASE`
- `MSSQL_USERNAME`
- `MSSQL_PASSWORD`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`
- `GEMINI_API_KEY`
- `GEMINI_MODEL` (default: gemini-2.0-flash)
- `SYNC_LOOKBACK_HOURS` (default: 24)
- `SYNC_BATCH_SIZE` (default: 50)

---

## Data Migration from tlc-time-stable

### Export from Production Database

Connect to your production Supabase and export:

```sql
-- Export profiles
COPY (
  SELECT id, email, first_name, last_name, hourly_rate, role,
         start_date, birthday, team, sub_team, employment_type,
         pto_rule, uto_rule, pto_rule_advance_at, created_at
  FROM profiles
) TO STDOUT WITH CSV HEADER;

-- Export employee_shifts
COPY (
  SELECT * FROM employee_shifts
) TO STDOUT WITH CSV HEADER;

-- Export time_entries
COPY (
  SELECT * FROM time_entries
) TO STDOUT WITH CSV HEADER;

-- Export time_off_requests
COPY (
  SELECT * FROM time_off_requests
) TO STDOUT WITH CSV HEADER;

-- Export time_corrections
COPY (
  SELECT * FROM time_corrections
) TO STDOUT WITH CSV HEADER;

-- Export time_off_rules
COPY (
  SELECT * FROM time_off_rules
) TO STDOUT WITH CSV HEADER;
```

### Import to New Database

Use Supabase Dashboard > Table Editor > Import CSV, or:

```sql
-- Disable triggers temporarily for bulk insert
ALTER TABLE profiles DISABLE TRIGGER ALL;
ALTER TABLE time_entries DISABLE TRIGGER ALL;
-- ... import data ...
ALTER TABLE profiles ENABLE TRIGGER ALL;
ALTER TABLE time_entries ENABLE TRIGGER ALL;
```

---

## Feature Verification Checklist

### Time Tracking Core
- [ ] User can log in
- [ ] User can clock in (respects 10-minute early rule)
- [ ] User can clock out
- [ ] Time entries appear in history
- [ ] Weekly hours display correctly
- [ ] Time corrections can be submitted
- [ ] Time corrections auto-approve for non-manual changes

### Employee Management
- [ ] Admin can view all employees
- [ ] Admin can edit employee info
- [ ] Sub-team dropdown works in employee profile
- [ ] Employment type dropdown works
- [ ] PTO/UTO rules can be assigned

### Time Off
- [ ] User can request PTO
- [ ] User can request UTO
- [ ] Manager can approve/deny requests
- [ ] Balance calculations are correct

### AI Auditing (Manual)
- [ ] Can upload/paste transcript
- [ ] Gemini API processes transcript
- [ ] Report card displays scores
- [ ] Criteria results show pass/fail/partial

### AI Auditing (Automated - Airflow)
- [ ] DAG runs every 15 minutes
- [ ] Calls sync from Five9
- [ ] Transcripts are fetched
- [ ] Calls are scored automatically
- [ ] Report cards are created

---

## Production Monitoring

### Key Metrics to Watch
1. **Airflow DAG Success Rate** - Should be >95%
2. **Gemini API Latency** - Typical: 2-5 seconds per call
3. **Cache Hit Rate** - Target: >30% after initial ramp
4. **Database Connection Pool** - Watch for exhaustion

### Common Issues

**"Tenant not found" on Supabase connection:**
- URL-encode special characters in password (@ becomes %40)

**Airflow DAG stuck:**
- Check Variables are set correctly
- Verify network access to Five9 SQL Server

**Gemini rate limiting:**
- Reduce `SYNC_BATCH_SIZE`
- Implement exponential backoff (already in DAG)

---

## Rollback Plan

If issues arise:

1. **Frontend**: Vercel allows instant rollback to previous deployment
2. **Database**: Supabase has point-in-time recovery (up to 7 days on Pro plan)
3. **Airflow**: Pause DAG, fix, unpause

---

## Support Contacts

- Supabase Dashboard: https://supabase.com/dashboard
- Gemini API Console: https://console.cloud.google.com/
- Vercel Dashboard: https://vercel.com/dashboard

---

Last Updated: 2026-01-06
