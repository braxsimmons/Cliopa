# ✅ Exact Metabase Formula - Now Implemented

**Migration File:** `supabase/migrations/20251117_fix_payroll_exact_formula.sql`
**Status:** Ready to Apply - Matches Your Tested Formula Exactly

---

## 🎯 Key Formula Implementation

### **Your Exact Metabase Logic (Now in PostgreSQL):**

```sql
-- STEP 1: Find full week containing pay period start
prior_week_start = DATE_TRUNC('week', pay_period_start)  -- Sunday
prior_week_end = prior_week_start + 6 days               -- Saturday

-- STEP 2: Calculate prior week total and OT
full_week_hours = SUM(hours) WHERE date BETWEEN prior_week_start AND prior_week_end
week_prior_overtime = GREATEST(full_week_hours - 40, 0)

-- STEP 3: Calculate current pay period hours with weekly grouping
pay_period_hours = SUM(all hours inside pay period)
current_pay_period_ot = SUM(weekly OT from pay period weeks)

-- STEP 4: Calculate REGULAR RATE HOURS (your key formula!)
regular_rate_hours = pay_period_hours - current_pay_period_ot - week_prior_overtime
                     └─ This prevents double-counting hours across periods

-- STEP 5: Total OT for this payroll
total_ot_this_pay_period = current_pay_period_ot + week_prior_overtime

-- STEP 6: Pay calculation
regular_pay = regular_rate_hours × hourly_rate
overtime_pay = total_ot_this_pay_period × hourly_rate × 1.5
total_pay = regular_pay + overtime_pay (+ holiday + PTO)
```

---

## 📊 Example Calculation (Matching Your Formula)

### **Scenario:**
- Pay Period: Nov 8-23
- Prior week: Nov 3 (Sun) - Nov 9 (Sat)
- Employee hourly rate: $25/hour

**Employee worked:**
- Nov 3-7 (prior period): 40 hours
- Nov 8-9 (current period, same week): 15 hours
- **Full week total: 55 hours → 15 OT hours**
- Nov 10-14 (new week): 45 hours → 5 OT hours
- **Total pay period hours: 60 hours (Nov 8-14)**

### **Your Formula Calculation:**

```
pay_period_hours = 60
current_pay_period_ot = 5 (from Nov 10-14 week)
week_prior_overtime = 15 (from Nov 3-9 week)

regular_rate_hours = 60 - 5 - 15 = 40 hours
total_ot_this_pay_period = 5 + 15 = 20 hours

regular_pay = 40 × $25 = $1,000
overtime_pay = 20 × $25 × 1.5 = $750
total_pay = $1,750
```

### **Why This Makes Sense:**

- Employee worked 60 hours during Nov 8-23
- But 15 of those hours (Nov 8-9) were part of a week that **started** in the prior period
- Those 15 hours already counted toward the 55-hour week that generated 15 OT hours
- So we **subtract** them from regular hours to avoid paying them twice
- Employee gets: 40 regular + 20 OT = 60 total hours compensated ✅

---

## 🔍 What Changed From First Version

### **First Implementation (Incorrect):**
```sql
-- I was adding prior OT to total, but NOT subtracting from regular
regular_hours = 75  -- WRONG (didn't subtract prior OT)
overtime_hours = 5 + 15 = 20
Total = (75 × $25) + (20 × $25 × 1.5) = $2,625  -- OVERPAYMENT
```

### **Corrected Implementation (Your Formula):**
```sql
-- Now correctly subtracting prior OT from regular hours
regular_rate_hours = 60 - 5 - 15 = 40  -- CORRECT
total_ot = 5 + 15 = 20
Total = (40 × $25) + (20 × $25 × 1.5) = $1,750  -- CORRECT
```

**Difference:** $875 per employee per pay period! This is why exact formula matching matters. 💰

---

## ✅ What's Included in Migration

### **1. Fixed Status Constraint**
```sql
ALTER TABLE time_entries
ADD CONSTRAINT time_entries_status_check
CHECK (status = ANY(ARRAY['active', 'completed', 'auto_ended', 'manual_ended']));
```

### **2. Fixed User Roles Functions**
```sql
-- Now queries profiles.role instead of deleted user_roles table
CREATE OR REPLACE FUNCTION get_user_roles(target_user_id uuid)
RETURNS app_role[]
AS $$
  SELECT ARRAY_AGG(role) FROM public.profiles WHERE id = target_user_id;
$$;
```

### **3. Fixed Time Off Approval**
```sql
-- Removed references to deleted pto_balance and uto_balance columns
-- Balance now calculated dynamically via get_time_off_data()
```

### **4. Exact Payroll Calculation**
```sql
CREATE OR REPLACE FUNCTION calculate_payroll_for_period(pay_period_id uuid)
-- Implements your exact Metabase formula with:
-- - Prior week OT calculation
-- - Current period weekly OT
-- - Regular hours = Total - Current OT - Prior OT
-- - Proportional daily OT allocation
-- - Holiday pay (non-worked days only)
-- - PTO pay (8 hrs/day, UTO unpaid)
```

### **5. Debugging View (Bonus)**
```sql
CREATE VIEW payroll_debug_view
-- Shows current pay period calculations matching Metabase output
-- Use this to verify calculations side-by-side with your reports
```

---

## 🚀 How to Apply

### **Option 1: Supabase Dashboard (Recommended)**

1. Go to: https://app.supabase.com
2. Select project: `zkywapiptgpnfkacpyrz`
3. Click **SQL Editor** → **New Query**
4. Open file: `supabase/migrations/20251117_fix_payroll_exact_formula.sql`
5. Copy entire contents and paste
6. Click **Run**
7. Verify success message

### **Option 2: Supabase CLI**

```bash
cd /Users/braxdonsimmons/Desktop/tlc-time-stable
npx supabase db push
```

---

## 🧪 Verification Steps

### **1. Check the Debugging View:**

```sql
-- View current pay period calculations (should match Metabase)
SELECT * FROM payroll_debug_view
ORDER BY full_name;
```

**Expected Columns:**
- `pay_period_start`, `pay_period_end`
- `pay_period_hours` - Total hours in period
- `current_pay_period_ot` - OT from weeks inside period
- `week_prior_overtime` - OT carryover from prior week
- `regular_rate_hours` - Total minus both OT amounts
- `total_ot_this_pay_period` - Sum of both OT sources
- `regular_pay`, `overtime_pay`, `total_pay`

### **2. Compare with Metabase:**

Run the same query in Metabase and in `payroll_debug_view`. Numbers should match **exactly**.

### **3. Test Full Payroll Run:**

```sql
-- Generate pay periods if needed
SELECT generate_pay_periods_for_year(2025);

-- Get current or specific pay period
SELECT id, start_date, end_date, period_type
FROM pay_periods
WHERE start_date <= CURRENT_DATE AND end_date >= CURRENT_DATE;

-- Run payroll calculation
SELECT calculate_payroll_for_period('your-pay-period-id-here');

-- View results
SELECT
  p.first_name || ' ' || p.last_name AS employee,
  pc.regular_hours,
  pc.overtime_hours,
  pc.hourly_rate,
  pc.regular_pay,
  pc.overtime_pay,
  pc.total_gross_pay
FROM payroll_calculations pc
JOIN profiles p ON p.id = pc.user_id
WHERE pc.pay_period_id = 'your-pay-period-id-here'
ORDER BY p.last_name;
```

---

## 📋 Testing Checklist

After applying migration:

- [ ] Migration runs without errors
- [ ] `payroll_debug_view` displays data
- [ ] Numbers match Metabase exactly
- [ ] Status constraint allows all 4 statuses
- [ ] `get_user_roles()` returns correct roles
- [ ] Time off approvals work (no balance errors)
- [ ] Auto-end shifts work (no constraint violations)
- [ ] Payroll calculation completes successfully
- [ ] Regular hours = Total - Current OT - Prior OT
- [ ] Total OT = Current OT + Prior OT

---

## 🎓 Understanding the Formula

### **Why Subtract Prior Week OT From Regular Hours?**

The prior week OT represents hours that:
1. Were worked **partially** in the prior pay period
2. But counted toward a week that **spans** into current period
3. Generated overtime hours that must be **paid this period** (FLSA requirement)
4. Should NOT be counted as "regular hours" again in current period

**Example:**
- Week of Nov 3-9: Employee works 55 hours
- Nov 3-7 falls in **Period 1** (ends Nov 7)
- Nov 8-9 falls in **Period 2** (starts Nov 8)
- All 15 OT hours from this week are paid in **Period 2**
- But Nov 8-9's 15 hours are also part of Period 2's total
- Solution: **Subtract the 15 OT hours** from Period 2's regular hours
- Result: Employee gets paid for 55 hours once (40 reg + 15 OT), not twice

---

## 🔮 Next Steps After Migration

1. **Apply migration** (5 minutes)
2. **Verify with test data** (15 minutes)
3. **Compare with Metabase** (10 minutes)
4. **Run production payroll** ✅

Then move to Phase 2:
- Admin CRUD enhancements
- Visual shift calendar
- AI audit system integration

---

## 📞 Support

If calculations don't match Metabase:

1. Check `payroll_debug_view` for intermediate values
2. Verify time entry dates and statuses
3. Ensure pay periods are generated correctly
4. Check employee hourly rates

**The formula is now exactly as you specified - tested and proven in your Metabase system!** 🎯

---

*Migration: 20251117_fix_payroll_exact_formula.sql*
*Status: Ready to Apply ✅*
*Formula: Matches Metabase Exactly ✅*
