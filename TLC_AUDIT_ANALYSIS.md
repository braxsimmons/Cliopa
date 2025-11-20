# TLC Audit System Analysis

## What You're Currently Tracking

I analyzed your Excel sheets and here's what I found:

### Two Types of Audits

**C-Audits (Collections/CCM):**
- Past Due Process (PDP) - 7 criteria
- Quality Systems - 17 criteria
- Quality Care - 9 criteria
- **Total: ~33 criteria per audit**

**R-Audits (Retention/CRM):**
- Retention Past Due Process (RPDP) - 7 criteria
- Quality Systems - 11 criteria
- Quality Care - 9 criteria
- **Total: ~27 criteria per audit**

### Key Audit Criteria I Identified

**Past Due Process (PDP1-PDP7):**
1. PD1, PD2, PD3, PD4, PD5, PD6, PD7
2. Binary scoring (1 = pass, blank = fail)

**Quality - Systems:**
- QQ (Qualifying Questions)
- VCI (Verify Customer Information)
- PERMISSION
- CAMPAIGN
- BANK V (Bank Verification)
- REVIEW TERMS
- LOAN DOCUMENT
- INITIATIONS
- PRE PD7 PERMISSION
- AMOUNT
- NOTIFICATION
- FOLLOW UP
- PAYMENT REMINDERS
- ACCOMMODATION
- R7/10/11 PROCESS
- CHANGE REQUESTS
- CORRECT DEPARTMENT

**Quality - Care:**
- WHY - SMILE
- WHY - CLIENT INTEREST
- WHAT - TIMELY
- WHAT - EMPATHY
- WHAT - LISTEN & EXPLORE
- WHERE - RESOLUTION
- HOW - PROCESSES
- HOW - SCRIPTS
- WHO - CORE VALUES

### Scoring System
- Individual criteria: Binary (1 or 0)
- PDP SCORE: % of PDP criteria passed
- COMPLIANCE SCORE: % of Systems criteria passed
- CARE SCORE: % of Care criteria passed

---

## 🎯 What You Need

### Option 1: Simple Import (Quickest)
**What:** Import your Excel data AS-IS into Cliopa
**Pros:** Historical data preserved exactly
**Cons:** Doesn't leverage AI auditing for new calls
**Timeline:** 4 hours to build

### Option 2: Hybrid Approach (RECOMMENDED)
**What:**
1. Import historical Excel audits (keep your detailed criteria)
2. Update AI audit template to match your TLC criteria
3. Use AI for new audits going forward (automatically checks all criteria)
4. Keep both systems compatible

**Pros:**
- ✅ All historical data preserved
- ✅ AI automatically audits new calls against TLC criteria
- ✅ Consistent scoring across old and new audits
- ✅ Reduce manual audit time by 90%

**Timeline:** 8 hours total
- 4 hours: CSV import tool
- 4 hours: Update AI template to TLC criteria

### Option 3: Full Migration
**What:** Rebuild your entire audit system in Cliopa with custom UI
**Pros:** Fully custom, exactly matches current workflow
**Cons:** Much longer to build (2-3 days)
**Timeline:** 2-3 days

---

## 💡 My Strong Recommendation: Option 2 (Hybrid)

Here's exactly what I'll build:

### Phase 1: Import Historical Data (4 hours)

**Build a CSV Import Tool:**
1. Upload your Excel exports (C-Audits and R-Audits)
2. Automatically map columns:
   - CCM NAME / CRM NAME → Agent lookup
   - DATE → created_at
   - Individual criteria (PD1, QQ, WHY-SMILE, etc.) → criteria_results JSON
   - PDP SCORE → overall_score
   - COMPLIANCE SCORE → compliance_score
   - CARE SCORE → empathy_score/tone_score
3. Import creates report_cards entries with full criteria breakdown

**Result:** All your historical audits in Cliopa

### Phase 2: Update AI Template (4 hours)

**Create TLC-specific audit templates:**

**Template: "TLC CCM Audit"** (for C-Audits)
- Past Due Process criteria (PDP1-7)
- Quality Systems criteria (QQ, VCI, PERMISSION, etc.)
- Quality Care criteria (WHY-SMILE, WHAT-EMPATHY, etc.)
- AI analyzes call transcripts against ALL criteria
- Returns same scoring structure you use now

**Template: "TLC CRM Audit"** (for R-Audits)
- Retention-specific criteria
- Quality Systems (retention-focused)
- Quality Care criteria

**Result:** AI automatically audits new calls with your exact criteria

### Phase 3: Unified Reporting

**Report Cards Dashboard shows:**
- Imported historical audits
- New AI-generated audits
- All with consistent TLC criteria
- Filter by CCM vs CRM
- Drill down into individual criteria
- Track trends over time

---

## 📊 Example: How AI Will Audit Against TLC Criteria

**Current (Manual):**
You listen to call → Check each of 27-33 boxes → Calculate scores → Enter in Excel
**Time:** 15-20 minutes per audit

**With AI (Automated):**
1. Call transcript sent to AI
2. AI analyzes against TLC template:
   ```
   ✅ QQ (Qualifying Questions) - PASS
      "Agent asked for name and verified account"

   ✅ VCI (Verify Customer Info) - PASS
      "Agent verified DOB and last 4 of SSN"

   ✅ WHY - SMILE - PASS
      "Agent maintained positive tone throughout"

   ❌ BANK V (Bank Verification) - FAIL
      "Agent did not verify bank account details"
   ```
3. Scores calculated automatically
4. Report card created
**Time:** 30 seconds

---

## 🔧 What I Need to Build This

### To Build Import Tool:
1. ✅ **Already have:** Your Excel structure (you just sent it)
2. **Need:** Confirm you want both C-Audits AND R-Audits imported
3. **Need:** Are there other tabs/sheets I should know about?

### To Build AI Templates:
1. **Need:** Definitions for each criterion
   - Example: What makes "QQ (Qualifying Questions)" a PASS vs FAIL?
   - Example: What should AI look for in "BANK V (Bank Verification)"?

2. **Need:** Confirm the criteria list is complete
   - Are those all the criteria you check?
   - Are C-Audit and R-Audit criteria sets correct?

---

## 📋 Proposed Action Plan

### Week 1 (This Week)
**Day 1-2:**
- ✅ Build CSV import tool
- ✅ Import all historical C-Audits and R-Audits
- ✅ Verify data in Report Cards dashboard

**Day 3-4:**
- ✅ Create TLC CCM audit template (27-33 criteria)
- ✅ Create TLC CRM audit template (27 criteria)
- ✅ Test AI auditing with sample calls

**Day 5:**
- ✅ Train team on new system
- ✅ Run parallel testing (manual + AI)
- ✅ Verify AI accuracy

### Week 2
- Transition to AI-first auditing
- Manual audit only for quality checks
- Five9 integration for full automation

---

## 💰 Expected Impact

**Current State:**
- Manual audit: 15-20 min per call
- 100 calls/month = 25-33 hours of manual work

**With Cliopa AI:**
- AI audit: 30 seconds per call
- 100 calls/month = 50 minutes total
- **Time saved: 24-32 hours/month**

**Accuracy:**
- Manual: Subject to human error/fatigue
- AI: Consistent, objective, auditable
- AI shows exact quotes from transcript supporting each score

---

## 🚀 Let's Start

**I recommend:** Build the Hybrid Approach (Option 2)

**Next steps:**
1. **Confirm:** You want to import both C-Audits and R-Audits
2. **Provide:** Definitions for key criteria (I'll ask specific questions)
3. **Export:** Your Excel files to CSV (I'll walk you through)
4. **Build:** I'll create the import tool customized for TLC

**Timeline:**
- Import tool ready: Later today (4 hours)
- AI templates ready: Tomorrow (4 hours)
- Full system operational: End of week

---

## 📝 Questions for You

1. **Do you want to import both C-Audits AND R-Audits?**

2. **Are there more tabs in your Excel beyond these two?**

3. **For the AI templates, should I:**
   - Create separate templates for CCM and CRM?
   - Use the same care criteria for both?

4. **Scoring preference:**
   - Keep your current % scoring (sum of 1s / total criteria)?
   - Or convert to 0-100 scale for Cliopa?

5. **Priority:**
   - Start with import tool first? (Get historical data in)
   - Or start with AI templates? (Get new audits working)

**Answer these and I'll start building immediately!**
