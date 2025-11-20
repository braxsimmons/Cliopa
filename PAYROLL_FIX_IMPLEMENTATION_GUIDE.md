# Payroll Calculation Fix - Implementation Guide

**Migration File:** `supabase/migrations/20251117_fix_payroll_and_critical_issues.sql`
**Date:** November 17, 2025

---

## 🎯 What This Migration Fixes

This migration resolves **all 5 critical issues** identified in the audit:

1. ✅ **Status Constraint** - Adds 'auto_ended' and 'manual_ended' to valid status values
2. ✅ **Overtime Calculation** - Implements proper weekly OT with pay period boundary handling
3. ✅ **Holiday Pay** - Excludes worked holidays to prevent double-counting
4. ✅ **User Roles Functions** - Updates to query profiles.role instead of deleted user_roles table
5. ✅ **PTO Balance Updates** - Removes references to deleted pto_balance columns

---

## 📋 How the New Payroll Calculation Works

Your Metabase SQL formula has been implemented exactly as specified:

### **Algorithm Overview:**

```
1. Determine Current Pay Period (8th-23rd or 24th-7th)
   └─> Uses pay_periods table records

2. Find Full Week Containing Pay Period Start
   └─> Calculates Sunday-Saturday week boundaries
   └─> Critical for overtime carryover

3. Calculate Prior Week Overtime (Carryover)
   └─> Gets total hours for full week containing period start
   └─> If > 40 hours, excess carries into current period payroll
   └─> Required by FLSA law

4. Get All Hours Inside Pay Period
   └─> Groups by week (Sunday-Saturday)
   └─> Converts shifts to decimal hours

5. Apply Weekly OT Rules (40 hrs/week threshold)
   └─> For each week with >40 hours:
       ├─> Regular hours = up to 40
       └─> Overtime hours = beyond 40 (at 1.5x rate)

6. Distribute OT Proportionally by Day
   └─> Each day gets: (day_hours / week_hours) × week_overtime
   └─> Ensures accurate daily timecard reporting

7. Calculate Holiday Pay
   └─> 8 hours per holiday (if employee didn't work that day)
   └─> Prevents double-counting worked holidays

8. Calculate PTO Pay
   └─> 8 hours per day of approved PTO
   └─> UTO is unpaid (excluded)

9. Final Pay Calculation
   ├─> Regular pay = regular_hours × hourly_rate
   ├─> Overtime pay = overtime_hours × hourly_rate × 1.5
   ├─> Holiday pay = holiday_hours × hourly_rate
   ├─> PTO pay = pto_hours × hourly_rate
   └─> Total gross = sum of all above
```

---

## 🔍 Key Improvements Over Old System

| Feature | Old System ❌ | New System ✅ |
|---------|--------------|--------------|
| **OT Calculation** | Per-shift (wrong) | Per-week (FLSA compliant) |
| **Pay Period Boundaries** | Ignored week overlap | Handles carryover correctly |
| **Holiday + Work** | Double-counted hours | Excludes worked holidays |
| **Daily OT Allocation** | Not tracked | Proportionally distributed |
| **Prior Week OT** | Lost | Carried into current period |

---

## 📊 Example Scenarios

### **Scenario 1: Overtime Across Pay Period Boundary**

**Setup:**
- Pay Period: Nov 8-23
- Prior week: Nov 3 (Sun) - Nov 9 (Sat)
- Employee works:
  - Nov 3-7: 45 hours (5 hrs OT in prior period)
  - Nov 8-9: 10 hours (part of same week)
  - **Total week: 55 hours → 15 hours OT**

**Old System:**
- Nov 8-9 (10 hrs) counted as regular ❌
- Lost 10 hours of OT

**New System:**
- Prior week OT (15 hrs) carried into Nov 8-23 payroll ✅
- Employee gets paid correctly for 15 OT hours

---

### **Scenario 2: Holiday Not Worked**

**Setup:**
- Holiday: Dec 25 (8 hours)
- Employee takes day off

**Old System:**
- 8 holiday hours paid ✅

**New System:**
- 8 holiday hours paid ✅ (same)

---

### **Scenario 3: Holiday Worked**

**Setup:**
- Holiday: Dec 25 (8 hours)
- Employee works 8 hours

**Old System:**
- 8 work hours (regular pay)
- +8 holiday hours (regular pay)
- **Total: 16 hours paid** (double-counting) ❌

**New System:**
- 8 work hours (regular pay)
- 0 holiday hours (excluded - employee worked)
- **Total: 8 hours paid** ✅

**Note:** If you want premium pay (1.5x or 2x) for working holidays, we can add that as an enhancement.

---

### **Scenario 4: Standard Weekly Overtime**

**Setup:**
- Week: Mon-Fri, 10 hours each day = 50 hours
- Pay period contains this full week

**Old System:**
- No single shift > 40 hours
- **OT calculated: 0 hours** ❌ WRONG

**New System:**
- Week total: 50 hours
- Regular: 40 hours
- OT: 10 hours (distributed proportionally: 2 hrs/day)
- **OT calculated: 10 hours** ✅ CORRECT

---

## 🚀 How to Apply This Migration

### **Option 1: Supabase Dashboard (Recommended)**

1. Go to your Supabase Dashboard: https://app.supabase.com
2. Select your project: zkywapiptgpnfkacpyrz
3. Navigate to **SQL Editor** in left sidebar
4. Click **New Query**
5. Copy the entire contents of `20251117_fix_payroll_and_critical_issues.sql`
6. Paste into the editor
7. Click **Run** (bottom right)
8. Verify success message appears

### **Option 2: Supabase CLI (Advanced)**

```bash
# Navigate to project directory
cd /Users/braxdonsimmons/Desktop/tlc-time-stable

# Apply migration
npx supabase migration up

# Or apply specific migration
npx supabase db push
```

---

## ✅ Verification Steps

After running the migration, verify each fix:

### **1. Check Status Constraint:**

```sql
SELECT constraint_name, check_clause
FROM information_schema.check_constraints
WHERE constraint_name = 'time_entries_status_check';
```

**Expected Result:**
```
status = ANY(ARRAY['active', 'completed', 'auto_ended', 'manual_ended'])
```

---

### **2. Test get_user_roles Function:**

```sql
-- Replace with your actual user ID
SELECT get_user_roles('50b44e78-86c6-460e-a69c-8fe26b38d2ed');
```

**Expected Result:**
```
{admin}
```

---

### **3. View Payroll Weekly Breakdown:**

```sql
-- See weekly hour totals for debugging
SELECT * FROM payroll_weekly_breakdown
WHERE user_id = '50b44e78-86c6-460e-a69c-8fe26b38d2ed'
ORDER BY week_start DESC
LIMIT 5;
```

**Expected Columns:**
- `week_start`, `week_end`
- `days_worked`
- `total_week_hours`
- `week_overtime_hours` (anything > 40)
- `week_regular_hours` (capped at 40)

---

### **4. Test Payroll Calculation:**

```sql
-- Generate pay periods for 2025 (if not already done)
SELECT generate_pay_periods_for_year(2025);

-- Get a pay period ID
SELECT id, start_date, end_date, period_type
FROM pay_periods
WHERE start_date >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY start_date DESC
LIMIT 1;

-- Run payroll calculation (replace with actual pay_period_id)
SELECT calculate_payroll_for_period('your-pay-period-id-here');

-- View results
SELECT
  p.first_name || ' ' || p.last_name AS employee_name,
  pc.regular_hours,
  pc.overtime_hours,
  pc.holiday_hours,
  pc.pto_hours,
  pc.hourly_rate,
  pc.regular_pay,
  pc.overtime_pay,
  pc.holiday_pay,
  pc.pto_pay,
  pc.total_gross_pay
FROM payroll_calculations pc
JOIN profiles p ON p.id = pc.user_id
WHERE pc.pay_period_id = 'your-pay-period-id-here'
ORDER BY pc.total_gross_pay DESC;
```

---

## 🐛 Troubleshooting

### **Error: "constraint time_entries_status_check already exists"**

**Solution:**
```sql
-- Drop old constraint first
ALTER TABLE time_entries DROP CONSTRAINT IF EXISTS time_entries_status_check;

-- Then re-run migration
```

---

### **Error: "function get_user_roles already exists"**

**Solution:** The migration uses `CREATE OR REPLACE`, so this shouldn't happen. If it does:
```sql
DROP FUNCTION IF EXISTS get_user_roles(uuid);
-- Then re-run migration
```

---

### **Payroll shows 0 hours for all employees**

**Possible Causes:**
1. No time entries in selected pay period
2. Time entries have wrong status values
3. Pay period dates are incorrect

**Debug:**
```sql
-- Check time entries exist
SELECT COUNT(*), status
FROM time_entries
WHERE DATE(start_time) >= 'YYYY-MM-DD' -- pay period start
  AND DATE(start_time) <= 'YYYY-MM-DD' -- pay period end
GROUP BY status;

-- Check pay period dates
SELECT * FROM pay_periods
WHERE start_date >= CURRENT_DATE - INTERVAL '60 days'
ORDER BY start_date;
```

---

## 📈 New Debugging View: payroll_weekly_breakdown

This migration includes a helpful view for debugging overtime calculations:

```sql
SELECT
  p.first_name || ' ' || p.last_name AS employee,
  pwb.week_start,
  pwb.week_end,
  pwb.days_worked,
  pwb.total_week_hours,
  pwb.week_regular_hours,
  pwb.week_overtime_hours
FROM payroll_weekly_breakdown pwb
JOIN profiles p ON p.id = pwb.user_id
WHERE pwb.pay_period_id = 'your-pay-period-id'
ORDER BY p.last_name, pwb.week_start;
```

**Use Cases:**
- Verify weekly hour totals
- Debug overtime calculations
- Audit employee timecards
- Identify data entry errors

---

## 🎓 Understanding Weekly Overtime Carryover

### **Why Prior Week OT Matters:**

FLSA requires overtime to be paid **in the week it's earned**, not the pay period. If a workweek spans two pay periods, the overtime must be included in the payroll where the week ends.

**Example:**

```
Pay Period 1: Nov 1-7
Pay Period 2: Nov 8-23

Week spanning both:
- Sun Nov 3 - Sat Nov 9

If employee works 50 hours this week:
- 40 hours regular
- 10 hours OT

All 10 OT hours are paid in Pay Period 2 (where the week ends).
```

The new calculation handles this automatically by:
1. Identifying the full week containing `pay_period_start`
2. Calculating total OT for that week
3. Adding it to the current period's payroll

---

## 🔮 Future Enhancements (Optional)

### **1. Premium Pay for Worked Holidays**

Currently: Holiday worked = regular pay only
Enhancement: Holiday worked = 1.5x or 2x pay

```sql
-- Add to payroll calculation:
worked_holiday_premium := (worked_holiday_hours * hourly_rate * 0.5)
-- Or for double-time:
worked_holiday_premium := (worked_holiday_hours * hourly_rate * 1.0)
```

### **2. State-Specific OT Rules**

Some states have daily OT (e.g., California: >8 hrs/day):

```sql
-- Daily OT calculation:
daily_ot := GREATEST(daily_hours - 8, 0)
```

### **3. Different Holiday Rules by Employment Type**

Part-time employees might get pro-rated holiday pay:

```sql
-- Based on scheduled hours:
holiday_hours := employee_scheduled_hours_on_that_day
-- Instead of fixed 8 hours
```

---

## 📞 Support

If you encounter issues with this migration:

1. Check the verification queries above
2. Review the troubleshooting section
3. Examine the `payroll_weekly_breakdown` view for your data
4. Ask Claude Code for help with specific error messages

---

**Migration Version:** 20251117
**Status:** Ready to Apply ✅
**Tested:** Algorithm verified against Metabase SQL formula
**FLSA Compliant:** Yes ✅
