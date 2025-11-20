# Apply TLC Audit Templates

## What This Does

Replaces the default 12-criteria template with your complete TLC audit templates:

✅ **TLC Collections Audit** - 34 criteria (PDP + Systems + Care)
✅ **TLC Retention Audit** - 28 criteria (RPDP + Systems + Care)

---

## Apply the Templates (2 minutes)

### Step 1: Open Supabase SQL Editor

Go to: https://supabase.com/dashboard/project/zkywapiptgpnfkacpyrz/sql/new

### Step 2: Copy the SQL

Open the file:
```
supabase/migrations/20251118_tlc_audit_templates.sql
```

Copy the entire contents.

### Step 3: Run in Supabase

1. Paste the SQL into the editor
2. Click "Run" (bottom right) or press `Cmd/Ctrl + Enter`
3. You should see:
   ```
   SUCCESS: TLC audit templates created successfully!
   ```

### Step 4: Verify

Run this query to confirm:

```sql
SELECT
  name,
  is_default,
  jsonb_array_length(criteria) as criteria_count
FROM audit_templates
ORDER BY is_default DESC;
```

You should see:
- **TLC Collections Audit** - 34 criteria (is_default = true)
- **TLC Retention Audit** - 28 criteria (is_default = false)

---

## What's Next

### Option A: Test AI Auditing with TLC Criteria

1. Go to AI Audit Tool
2. Select an agent
3. Paste a sample call transcript
4. Click "Generate AI Audit"
5. AI will analyze against all 34 TLC criteria!

**Result:**
- Each criterion scored (PASS/PARTIAL/FAIL)
- Explanations for each score
- Overall compliance/care scores
- Detailed feedback

### Option B: Import Historical Excel Data

Now that templates match your TLC criteria, we can build the CSV import tool to bring in all your historical audits.

**I'll build:**
- Upload CSV from Excel export
- Auto-map columns to TLC criteria
- Import all historical C-Audits and R-Audits
- Preserve all scoring and metadata

---

## TLC Criteria Breakdown

### Collections (CCM) - 34 Criteria

**Past Due Process (7):** PD1-7

**Quality Systems - Processing (18):**
- QQ, VCI, PERMISSION, CAMPAIGN, BANKV
- REVIEW_TERMS, LOAN_DOCUMENT, INITIATION
- PRE_PD7_PERMISSION, AMOUNT, NOTIFICATION
- FOLLOW_UP, PAYMENT_REMINDERS, ACCOMMODATION
- R7_R10_R11, CHANGE_REQUESTS, CORRECT_DEPT
- NOTES, CI

**Quality Care (9):**
- WHY_SMILE, WHY_CLIENT_INTEREST
- WHAT_TIMELY, WHAT_EMPATHY, WHAT_LISTEN_EXPLORE
- WHERE_RESOLUTION, HOW_PROCESS, HOW_SCRIPTS
- WHO_CORE_VALUES

### Retention (CRM) - 28 Criteria

**Retention Past Due Process (7):** RPD1-7

**Quality Systems (12):**
- CAMPAIGN, VCI, SCHEDULED_AMOUNT, PAYMENTS
- PAYMENT_PLAN_EMAIL, COMMENT_UPDATE
- FOLLOW_UP, PAYMENT_REMINDERS, ACCOMMODATION
- CHANGE_REQUESTS, NOTES, CI

**Quality Care (9):** Same as Collections

---

## How AI Uses These Templates

When you create an audit (manual or automatic via Five9):

1. **AI receives:** Call transcript
2. **AI checks:** All 34 criteria (or 28 for CRM)
3. **AI returns:**
   ```json
   {
     "PD1": {
       "result": "PASS",
       "explanation": "Agent followed PD1 process: verified account before proceeding, documented in notes"
     },
     "QQ": {
       "result": "PASS",
       "explanation": "Qualifying questions asked: 'May I have your name?' and 'Can you verify your DOB?'"
     },
     "BANKV": {
       "result": "FAIL",
       "explanation": "Bank verification was not performed or documented in the call"
     }
   }
   ```

4. **System calculates:**
   - Overall score: % of all criteria passed
   - Compliance score: % of compliance criteria passed
   - Care score: % of care criteria passed
   - Individual dimensional scores

---

## Testing Checklist

After applying templates:

- [ ] Templates appear in database (2 templates)
- [ ] TLC Collections is default (is_default = true)
- [ ] AI Audit Tool shows new criteria count
- [ ] Test audit shows all 34 criteria results
- [ ] Scores calculated correctly
- [ ] Report card displays properly

---

**Ready to apply?**

Run the SQL migration and your AI will audit calls using your complete TLC criteria!
