# 🔧 Apply Database Migration

## Problem
The Report Cards page is showing a 406 error because the database tables don't exist yet.

**Error:**
```
Failed to load resource: the server responded with a status of 406
Error fetching performance summary
```

## Solution: Apply the Migration

The migration file `supabase/migrations/20251117_ai_audit_system.sql` needs to be applied to your Supabase database.

---

## Option 1: Apply via Supabase Dashboard (Easiest)

1. **Log into Supabase Dashboard**: https://supabase.com/dashboard
2. **Select your project**
3. **Go to SQL Editor** (left sidebar)
4. **Click "New Query"**
5. **Copy the entire contents** of `supabase/migrations/20251117_ai_audit_system.sql`
6. **Paste into the SQL editor**
7. **Click "Run"** (or press Cmd/Ctrl + Enter)
8. **Verify success** - Should say "Success. No rows returned"

---

## Option 2: Apply via Supabase CLI

### If you have Supabase running locally:

```bash
# Make sure Supabase is running
npx supabase start

# Apply migrations
npx supabase db push
```

### If you want to apply to production:

```bash
# Login to Supabase
npx supabase login

# Link to your project
npx supabase link --project-ref YOUR_PROJECT_REF

# Push migration to production
npx supabase db push
```

---

## What the Migration Creates

The migration will create these tables:

1. **`calls`** - Stores Five9 call recordings and metadata
2. **`report_cards`** - Stores AI-generated audit scores and feedback
3. **`audit_templates`** - Configurable audit criteria (with 27 default TLC criteria)
4. **`audit_cache`** - Prevents duplicate AI processing (SHA-256 hash caching)
5. **`agent_performance_summary`** - VIEW for 30-day performance metrics

Plus:
- Row-Level Security (RLS) policies
- Indexes for performance
- Triggers for automatic timestamp updates

---

## Verify Migration Applied

After running the migration, verify it worked:

### In Supabase Dashboard:

1. Go to **Table Editor** (left sidebar)
2. You should see these new tables:
   - `calls`
   - `report_cards`
   - `audit_templates`
   - `audit_cache`

3. Check `audit_templates` table has 1 row (the default template)

### In Your App:

1. Refresh the **Report Cards** page
2. Should load without errors (will be empty until you create report cards)
3. Console should show warnings instead of errors

---

## After Migration

Once the migration is applied:

1. ✅ Report Cards page will load properly
2. ✅ AI Audit Upload will be able to save results
3. ✅ Five9 webhook integration will be able to store calls
4. ✅ Performance summaries will calculate correctly

---

## Next Steps

After applying the migration:

1. **Test AI Audit Upload**:
   - Go to AI Audit Tool page
   - Paste a sample transcript
   - Generate an audit
   - Should create a report card in database

2. **View Report Cards**:
   - Go to Report Cards page
   - Should see your test audit result
   - No more 406 errors

3. **Deploy Five9 Integration** (when ready):
   - Follow `FIVE9_DEPLOYMENT_GUIDE.md`
   - Deploy Edge Functions
   - Configure Five9 webhook
   - Start receiving automatic report cards

---

## Troubleshooting

### Error: "relation 'calls' does not exist"
**Solution:** Migration wasn't applied. Try Option 1 (Supabase Dashboard) again.

### Error: "permission denied"
**Solution:** Make sure you're using your Service Role key or are logged in as project owner.

### Error: "syntax error at or near..."
**Solution:** Make sure you copied the ENTIRE SQL file, including the final semicolons.

### Migration succeeds but tables still don't appear
**Solution:**
1. Hard refresh the Supabase dashboard (Cmd/Ctrl + Shift + R)
2. Check you're looking at the correct project
3. Check you're on the "Table Editor" tab, not "Database" tab

---

## Quick Test After Migration

**SQL Query to test (run in SQL Editor):**

```sql
-- Should return 1 row with 27 criteria
SELECT * FROM audit_templates WHERE is_default = true;

-- Should return 0 rows (no report cards yet)
SELECT COUNT(*) FROM report_cards;

-- Should return 0 rows (no calls yet)
SELECT COUNT(*) FROM calls;
```

If all three queries succeed, your migration is applied correctly! 🎉
