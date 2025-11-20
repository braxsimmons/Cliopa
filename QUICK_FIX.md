# 🚀 Quick Fix - Apply Database Migration

## Current Issue
You're seeing 406 errors because the database tables (`report_cards`, `calls`, etc.) don't exist yet.

## ⚡ Fastest Fix (2 minutes)

### Step 1: Copy the SQL

Open `supabase/migrations/20251117_ai_audit_system.sql` and copy the **entire file contents**.

### Step 2: Run in Supabase

1. Go to: **https://supabase.com/dashboard/project/zkywapiptgpnfkacpyrz/sql/new**
   (This is your project's SQL editor - direct link!)

2. Paste the entire SQL

3. Click **"Run"** (bottom right) or press `Cmd/Ctrl + Enter`

4. You should see: ✅ **"Success. No rows returned"**

### Step 3: Verify

Run this test query in the same SQL editor:

```sql
SELECT COUNT(*) FROM report_cards;
SELECT COUNT(*) FROM calls;
SELECT * FROM audit_templates WHERE is_default = true;
```

You should get:
- `report_cards`: 0 rows (empty, that's correct)
- `calls`: 0 rows (empty, that's correct)
- `audit_templates`: 1 row with 27 criteria ✅

### Step 4: Refresh App

Refresh your browser at `http://localhost:8081/report-cards`

The yellow warning should disappear and you'll see an empty report cards list (which is correct - no audits have been run yet).

---

## What Happens Next

After applying the migration:

1. ✅ **Report Cards page** - Will load properly (empty list)
2. ✅ **AI Audit Tool** - Will be able to save results
3. ✅ **Five9 Integration** - Ready to receive webhooks

---

## Test the System

### Test AI Audit Upload

1. Go to **AI Audit Tool** page
2. Select an agent
3. Paste this sample transcript:

```
Agent: Thank you for calling TLC Financial Services, this is John. May I have your name please?

Customer: Hi, this is Sarah Johnson.

Agent: Hi Sarah, before we proceed I need to verify your account. Can you please confirm your date of birth and the last four digits of your social security number?

Customer: Sure, it's March 15th, 1985, and the last four are 7421.

Agent: Thank you Sarah. I've verified your account. How can I help you today?

Customer: I'm calling about my loan payment. I'm having some difficulty making this month's payment due to unexpected medical expenses.

Agent: I'm sorry to hear that Sarah. I understand unexpected expenses can be challenging. Let me review your account and see what options we have available to help you.
```

4. Click **"Generate AI Audit"**

5. If LM Studio is running, it should process in 2-5 seconds

6. Go to **Report Cards** page - you should see your first report card! 🎉

---

## Still Having Issues?

### Can't access Supabase Dashboard?
- Make sure you're logged into the correct Supabase account
- Check you have access to project `zkywapiptgpnfkacpyrz`

### SQL fails with "permission denied"?
- Make sure you're project owner or have sufficient permissions
- Try using the SQL editor instead of the API

### Tables still don't appear?
- Hard refresh Supabase dashboard (Cmd/Ctrl + Shift + R)
- Wait 10 seconds and refresh again
- Check you ran the **entire** SQL file

---

**Your project ID:** `zkywapiptgpnfkacpyrz`

**Direct SQL Editor Link:** https://supabase.com/dashboard/project/zkywapiptgpnfkacpyrz/sql/new

Copy the SQL, paste, run, refresh app. That's it! 🚀
