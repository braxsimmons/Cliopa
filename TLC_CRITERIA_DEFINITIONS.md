# TLC Audit Criteria Definitions

## Scoring System
- **1** = Yes (Pass)
- **0** = No (Fail)
- **Blank** = N/A or Warning

---

## PAST DUE PROCESS (PD-1 through PD-7)

**Criteria:** Process is applicable and every step of the process as outlined in the Guidebook was followed as demonstrated in the file AND documented by the notes.

**Each PD step must be:**
- Applicable to the situation
- Followed per Guidebook
- Demonstrated in file
- Documented in notes

---

## QUALITY - SYSTEMS

### PROCESSING

**QQ (Qualifying Questions)**
- Were qualifying questions asked AND documented?

**VCI (Verify Customer Information)**
- Did CCM ask AND document they verified customer information?
- Was the file updated appropriately?

**PERMISSION**
- Did CCM ask AND document permission to proceed?
- Was the file updated appropriately?

**CAMPAIGN**
- Was the correct campaign noted?

**BANK V (Bank Verification)**
- Was the BANKV process correctly followed and noted?

**REVIEWED TERMS**
- Were the loan terms correctly reviewed and documented in the file?

**LOAN DOCUMENT**
- Does the file have the loan document attached?
- Is it properly executed by the client?
- Does it include documentation of the client's IP address?

**INITIATION**
- Does the file demonstrate clear indication of how the loan process was initiated?

**PRE PD7 PERMISSION**
- Does the file demonstrate clear indication that permission was given?

**AMOUNT**
- Was the submitted loan amount appropriate for the client's credit limit?

**NOTIFICATION**
- If the loan was approved, was the client correctly notified of the approval?
- Was the notification documented appropriately?

### SERVICE

**FOLLOW UP**
- Was any required follow up with the client pursued promptly/appropriately (including LMS Follow Up process)?
- Was it documented correctly?

**PAYMENT REMINDERS**
- Has the CCM made all applicable payment reminder calls/emails?

**ACCOMMODATION**
- Has the CCM offered and followed appropriate accommodation procedures?

**R7/R10/R11 PROCESS**
- Has the CCM followed the R7/10/11 process correctly?

**CHANGE REQUESTS**
- Was any payment type change request documented and processed correctly?

**CORRECT DEPARTMENT**
- Should the loan still be with the CRM?

**NOTES**
- Did the CCM properly document the file using the correct note format and adequate notation?

**CI (Client Interest)**
- Was client interest consistently obtained, documented and updated?

---

## QUALITY - CARE

**WHY - SMILE**
- After listening to all call recordings related to this file, did the CCM's sincerity, tone and friendliness live up to our highest standards of care?

**WHY - CLIENT INTEREST**
- Was client interest (CI) obtained and documented?

**WHAT - TIMELY**
- If applicable, was the client responded to in a timely manner?
- OR was the call dispositioned in a timely manner?

**WHAT - EMPATHY**
- Did the CCM demonstrate care and concern?

**WHAT - LISTEN & EXPLORE**
- Did the CCM listen to the customer and explore solutions?

**WHERE - RESOLUTION**
- Was appropriate resolution pursued?
- Was it a resolution that found the right solution that was fair to both the client and the lender?
- (We want to be the preferred lender to every responsible client.)

**HOW - PROCESS**
- Did the CCM follow all applicable processes?

**HOW - SCRIPTS**
- After listening to all call recordings related to this audit, did the CCM MOSTLY comply with all applicable scripts?

**WHO - CORE VALUES**
- Did the call demonstrate that the CCM/CRM live up to Yatta's Core Values of Integrity, Passion and Excellence?

---

## AI Template Structure

This will be converted into a JSON template for AI auditing:

```json
{
  "name": "TLC Collections Audit",
  "description": "Complete TLC audit for Collections (CCM) calls",
  "criteria": [
    {
      "id": "PD1",
      "name": "Past Due Process Step 1",
      "description": "Process step 1 was applicable, followed per Guidebook, demonstrated in file, and documented",
      "dimension": "compliance",
      "weight": 1.0
    },
    {
      "id": "QQ",
      "name": "Qualifying Questions",
      "description": "Were qualifying questions asked AND documented?",
      "dimension": "compliance",
      "weight": 1.0
    },
    {
      "id": "WHY_SMILE",
      "name": "Smile - Tone & Friendliness",
      "description": "Did CCM's sincerity, tone and friendliness live up to highest standards of care?",
      "dimension": "tone",
      "weight": 1.0
    }
    // ... all criteria
  ]
}
```

---

## Dimensional Scoring Mapping

**Compliance Score** (Quality - Systems):
- QQ, VCI, PERMISSION, CAMPAIGN, BANK V, REVIEWED TERMS, LOAN DOCUMENT, INITIATION, PRE PD7 PERMISSION, AMOUNT, NOTIFICATION

**Service Score** (Quality - Systems - Service):
- FOLLOW UP, PAYMENT REMINDERS, ACCOMMODATION, R7/R10/R11 PROCESS, CHANGE REQUESTS, CORRECT DEPARTMENT, NOTES, CI

**Care/Tone Score** (Quality - Care):
- WHY-SMILE, WHY-CLIENT INTEREST, WHAT-TIMELY, WHAT-EMPATHY, WHAT-LISTEN & EXPLORE, WHERE-RESOLUTION, HOW-PROCESS, HOW-SCRIPTS, WHO-CORE VALUES

**Overall Score:**
- Average of all applicable criteria (PDP + Systems + Care)
