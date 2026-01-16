-- TLC Audit Templates Migration
-- Adds Collections (CCM) and Retention (CRM) audit templates with full TLC criteria

-- Remove old default template
DELETE FROM public.audit_templates WHERE is_default = true;

-- ============================================================================
-- TLC COLLECTIONS (CCM) AUDIT TEMPLATE
-- ============================================================================

INSERT INTO public.audit_templates (name, description, is_default, criteria)
VALUES (
  'TLC Collections Audit',
  'Complete audit template for Collections (CCM) calls with Past Due Process, Quality Systems, and Quality Care criteria',
  TRUE,
  '[
    {
      "id": "PD1",
      "name": "Past Due Process Step 1",
      "description": "Process step 1 was applicable, followed per Guidebook, demonstrated in file, and documented in notes",
      "dimension": "compliance",
      "weight": 1.0
    },
    {
      "id": "PD2",
      "name": "Past Due Process Step 2",
      "description": "Process step 2 was applicable, followed per Guidebook, demonstrated in file, and documented in notes",
      "dimension": "compliance",
      "weight": 1.0
    },
    {
      "id": "PD3",
      "name": "Past Due Process Step 3",
      "description": "Process step 3 was applicable, followed per Guidebook, demonstrated in file, and documented in notes",
      "dimension": "compliance",
      "weight": 1.0
    },
    {
      "id": "PD4",
      "name": "Past Due Process Step 4",
      "description": "Process step 4 was applicable, followed per Guidebook, demonstrated in file, and documented in notes",
      "dimension": "compliance",
      "weight": 1.0
    },
    {
      "id": "PD5",
      "name": "Past Due Process Step 5",
      "description": "Process step 5 was applicable, followed per Guidebook, demonstrated in file, and documented in notes",
      "dimension": "compliance",
      "weight": 1.0
    },
    {
      "id": "PD6",
      "name": "Past Due Process Step 6",
      "description": "Process step 6 was applicable, followed per Guidebook, demonstrated in file, and documented in notes",
      "dimension": "compliance",
      "weight": 1.0
    },
    {
      "id": "PD7",
      "name": "Past Due Process Step 7",
      "description": "Process step 7 was applicable, followed per Guidebook, demonstrated in file, and documented in notes",
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
      "id": "VCI",
      "name": "Verify Customer Information",
      "description": "Did CCM ask AND document they verified customer information? Was the file updated appropriately?",
      "dimension": "compliance",
      "weight": 1.0
    },
    {
      "id": "PERMISSION",
      "name": "Permission to Proceed",
      "description": "Did CCM ask AND document permission to proceed? Was the file updated appropriately?",
      "dimension": "compliance",
      "weight": 1.0
    },
    {
      "id": "CAMPAIGN",
      "name": "Correct Campaign Noted",
      "description": "Was the correct campaign noted in the file?",
      "dimension": "accuracy",
      "weight": 1.0
    },
    {
      "id": "BANKV",
      "name": "Bank Verification",
      "description": "Was the BANKV process correctly followed and noted?",
      "dimension": "compliance",
      "weight": 1.0
    },
    {
      "id": "REVIEW_TERMS",
      "name": "Reviewed Loan Terms",
      "description": "Were the loan terms correctly reviewed and documented in the file?",
      "dimension": "compliance",
      "weight": 1.0
    },
    {
      "id": "LOAN_DOCUMENT",
      "name": "Loan Documentation",
      "description": "Does the file have the loan document attached, properly executed by client, including IP address documentation?",
      "dimension": "accuracy",
      "weight": 1.0
    },
    {
      "id": "INITIATION",
      "name": "Loan Initiation Process",
      "description": "Does the file demonstrate clear indication of how the loan process was initiated?",
      "dimension": "accuracy",
      "weight": 1.0
    },
    {
      "id": "PRE_PD7_PERMISSION",
      "name": "Pre-PD7 Permission",
      "description": "Does the file demonstrate clear indication that permission was given before PD7?",
      "dimension": "compliance",
      "weight": 1.0
    },
    {
      "id": "AMOUNT",
      "name": "Appropriate Loan Amount",
      "description": "Was the submitted loan amount appropriate for the client credit limit?",
      "dimension": "accuracy",
      "weight": 1.0
    },
    {
      "id": "NOTIFICATION",
      "name": "Approval Notification",
      "description": "If loan was approved, was client correctly notified and was notification documented appropriately?",
      "dimension": "communication",
      "weight": 1.0
    },
    {
      "id": "FOLLOW_UP",
      "name": "Follow Up Process",
      "description": "Was any required follow up with client pursued promptly/appropriately (including LMS Follow Up process) and documented correctly?",
      "dimension": "resolution",
      "weight": 1.0
    },
    {
      "id": "PAYMENT_REMINDERS",
      "name": "Payment Reminders",
      "description": "Has the CCM made all applicable payment reminder calls/emails?",
      "dimension": "resolution",
      "weight": 1.0
    },
    {
      "id": "ACCOMMODATION",
      "name": "Client Accommodation",
      "description": "Has the CCM offered and followed appropriate accommodation procedures?",
      "dimension": "empathy",
      "weight": 1.0
    },
    {
      "id": "R7_R10_R11",
      "name": "R7/R10/R11 Process",
      "description": "Has the CCM followed the R7/10/11 process correctly?",
      "dimension": "compliance",
      "weight": 1.0
    },
    {
      "id": "CHANGE_REQUESTS",
      "name": "Payment Change Requests",
      "description": "Was any payment type change request documented and processed correctly?",
      "dimension": "accuracy",
      "weight": 1.0
    },
    {
      "id": "CORRECT_DEPT",
      "name": "Correct Department",
      "description": "Should the loan still be with the CRM? Is it in the correct department?",
      "dimension": "accuracy",
      "weight": 1.0
    },
    {
      "id": "NOTES",
      "name": "Proper Documentation",
      "description": "Did the CCM properly document the file using the correct note format and adequate notation?",
      "dimension": "accuracy",
      "weight": 1.0
    },
    {
      "id": "CI",
      "name": "Client Interest",
      "description": "Was client interest (CI) consistently obtained, documented and updated?",
      "dimension": "empathy",
      "weight": 1.0
    },
    {
      "id": "WHY_SMILE",
      "name": "Smile - Tone & Friendliness",
      "description": "After listening to all call recordings, did the CCM sincerity, tone and friendliness live up to our highest standards of care?",
      "dimension": "tone",
      "weight": 1.0
    },
    {
      "id": "WHY_CLIENT_INTEREST",
      "name": "Client Interest Obtained",
      "description": "Was client interest (CI) obtained and documented?",
      "dimension": "empathy",
      "weight": 1.0
    },
    {
      "id": "WHAT_TIMELY",
      "name": "Timely Response",
      "description": "If applicable, was the client responded to in a timely manner? Or was the call dispositioned in a timely manner?",
      "dimension": "resolution",
      "weight": 1.0
    },
    {
      "id": "WHAT_EMPATHY",
      "name": "Demonstrated Empathy",
      "description": "Did the CCM demonstrate care and concern for the customer?",
      "dimension": "empathy",
      "weight": 1.0
    },
    {
      "id": "WHAT_LISTEN_EXPLORE",
      "name": "Listen & Explore Solutions",
      "description": "Did the CCM listen to the customer and explore solutions?",
      "dimension": "communication",
      "weight": 1.0
    },
    {
      "id": "WHERE_RESOLUTION",
      "name": "Appropriate Resolution",
      "description": "Was appropriate resolution pursued? A resolution that was fair to both client and lender?",
      "dimension": "resolution",
      "weight": 1.0
    },
    {
      "id": "HOW_PROCESS",
      "name": "Followed Processes",
      "description": "Did the CCM follow all applicable processes?",
      "dimension": "compliance",
      "weight": 1.0
    },
    {
      "id": "HOW_SCRIPTS",
      "name": "Script Compliance",
      "description": "After listening to all call recordings, did the CCM MOSTLY comply with all applicable scripts?",
      "dimension": "compliance",
      "weight": 1.0
    },
    {
      "id": "WHO_CORE_VALUES",
      "name": "Core Values - Integrity, Passion, Excellence",
      "description": "Did the call demonstrate that the CCM/CRM live up to Yatta Core Values of Integrity, Passion and Excellence?",
      "dimension": "tone",
      "weight": 1.0
    }
  ]'::jsonb
);

-- ============================================================================
-- TLC RETENTION (CRM) AUDIT TEMPLATE
-- ============================================================================

INSERT INTO public.audit_templates (name, description, is_default, criteria)
VALUES (
  'TLC Retention Audit',
  'Complete audit template for Retention (CRM) calls with Retention Past Due Process, Quality Systems, and Quality Care criteria',
  FALSE,
  '[
    {
      "id": "RPD1",
      "name": "Retention Past Due Process Step 1",
      "description": "Retention process step 1 was applicable, followed per Guidebook, demonstrated and documented",
      "dimension": "compliance",
      "weight": 1.0
    },
    {
      "id": "RPD2",
      "name": "Retention Past Due Process Step 2",
      "description": "Retention process step 2 was applicable, followed per Guidebook, demonstrated and documented",
      "dimension": "compliance",
      "weight": 1.0
    },
    {
      "id": "RPD3",
      "name": "Retention Past Due Process Step 3",
      "description": "Retention process step 3 was applicable, followed per Guidebook, demonstrated and documented",
      "dimension": "compliance",
      "weight": 1.0
    },
    {
      "id": "RPD4",
      "name": "Retention Past Due Process Step 4",
      "description": "Retention process step 4 was applicable, followed per Guidebook, demonstrated and documented",
      "dimension": "compliance",
      "weight": 1.0
    },
    {
      "id": "RPD5",
      "name": "Retention Past Due Process Step 5",
      "description": "Retention process step 5 was applicable, followed per Guidebook, demonstrated and documented",
      "dimension": "compliance",
      "weight": 1.0
    },
    {
      "id": "RPD6",
      "name": "Retention Past Due Process Step 6",
      "description": "Retention process step 6 was applicable, followed per Guidebook, demonstrated and documented",
      "dimension": "compliance",
      "weight": 1.0
    },
    {
      "id": "RPD7",
      "name": "Retention Past Due Process Step 7",
      "description": "Retention process step 7 was applicable, followed per Guidebook, demonstrated and documented",
      "dimension": "compliance",
      "weight": 1.0
    },
    {
      "id": "CAMPAIGN",
      "name": "Correct Campaign",
      "description": "Was the correct campaign noted?",
      "dimension": "accuracy",
      "weight": 1.0
    },
    {
      "id": "VCI",
      "name": "Verify Customer Information",
      "description": "Did CRM verify and document customer information correctly?",
      "dimension": "compliance",
      "weight": 1.0
    },
    {
      "id": "SCHEDULED_AMOUNT",
      "name": "Scheduled Amount",
      "description": "Was the scheduled payment amount correctly documented?",
      "dimension": "accuracy",
      "weight": 1.0
    },
    {
      "id": "PAYMENTS",
      "name": "Payment Processing",
      "description": "Were payments processed and documented correctly?",
      "dimension": "accuracy",
      "weight": 1.0
    },
    {
      "id": "PAYMENT_PLAN_EMAIL",
      "name": "Payment Plan Email",
      "description": "Was payment plan email sent and documented?",
      "dimension": "communication",
      "weight": 1.0
    },
    {
      "id": "COMMENT_UPDATE",
      "name": "Comment Updates",
      "description": "Were comments properly updated in the file?",
      "dimension": "accuracy",
      "weight": 1.0
    },
    {
      "id": "FOLLOW_UP",
      "name": "Follow Up",
      "description": "Was required follow up pursued promptly and documented?",
      "dimension": "resolution",
      "weight": 1.0
    },
    {
      "id": "PAYMENT_REMINDERS",
      "name": "Payment Reminders",
      "description": "Has the CRM made all applicable payment reminder calls/emails?",
      "dimension": "resolution",
      "weight": 1.0
    },
    {
      "id": "ACCOMMODATION",
      "name": "Client Accommodation",
      "description": "Has the CRM offered and followed appropriate accommodation procedures?",
      "dimension": "empathy",
      "weight": 1.0
    },
    {
      "id": "CHANGE_REQUESTS",
      "name": "Change Requests",
      "description": "Were change requests documented and processed correctly?",
      "dimension": "accuracy",
      "weight": 1.0
    },
    {
      "id": "NOTES",
      "name": "Proper Documentation",
      "description": "Did the CRM properly document the file using correct format and adequate notation?",
      "dimension": "accuracy",
      "weight": 1.0
    },
    {
      "id": "CI",
      "name": "Client Interest",
      "description": "Was client interest consistently obtained, documented and updated?",
      "dimension": "empathy",
      "weight": 1.0
    },
    {
      "id": "WHY_SMILE",
      "name": "Smile - Tone & Friendliness",
      "description": "Did the CRM sincerity, tone and friendliness live up to our highest standards of care?",
      "dimension": "tone",
      "weight": 1.0
    },
    {
      "id": "WHY_CLIENT_INTEREST",
      "name": "Client Interest Obtained",
      "description": "Was client interest obtained and documented?",
      "dimension": "empathy",
      "weight": 1.0
    },
    {
      "id": "WHAT_TIMELY",
      "name": "Timely Response",
      "description": "Was the client responded to or call dispositioned in a timely manner?",
      "dimension": "resolution",
      "weight": 1.0
    },
    {
      "id": "WHAT_EMPATHY",
      "name": "Demonstrated Empathy",
      "description": "Did the CRM demonstrate care and concern?",
      "dimension": "empathy",
      "weight": 1.0
    },
    {
      "id": "WHAT_LISTEN_EXPLORE",
      "name": "Listen & Explore Solutions",
      "description": "Did the CRM listen to the customer and explore solutions?",
      "dimension": "communication",
      "weight": 1.0
    },
    {
      "id": "WHERE_RESOLUTION",
      "name": "Appropriate Resolution",
      "description": "Was appropriate resolution pursued that was fair to both client and lender?",
      "dimension": "resolution",
      "weight": 1.0
    },
    {
      "id": "HOW_PROCESS",
      "name": "Followed Processes",
      "description": "Did the CRM follow all applicable processes?",
      "dimension": "compliance",
      "weight": 1.0
    },
    {
      "id": "HOW_SCRIPTS",
      "name": "Script Compliance",
      "description": "Did the CRM MOSTLY comply with all applicable scripts?",
      "dimension": "compliance",
      "weight": 1.0
    },
    {
      "id": "WHO_CORE_VALUES",
      "name": "Core Values",
      "description": "Did the call demonstrate Yatta Core Values of Integrity, Passion and Excellence?",
      "dimension": "tone",
      "weight": 1.0
    }
  ]'::jsonb
);

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
DECLARE
  ccm_count INTEGER;
  crm_count INTEGER;
BEGIN
  -- Count templates
  SELECT COUNT(*) INTO ccm_count FROM public.audit_templates WHERE name = 'TLC Collections Audit';
  SELECT COUNT(*) INTO crm_count FROM public.audit_templates WHERE name = 'TLC Retention Audit';

  RAISE NOTICE 'TLC Collections template created: %', ccm_count;
  RAISE NOTICE 'TLC Retention template created: %', crm_count;

  IF ccm_count = 1 AND crm_count = 1 THEN
    RAISE NOTICE 'SUCCESS: TLC audit templates created successfully!';
  ELSE
    RAISE WARNING 'Templates may not have been created correctly';
  END IF;
END $$;
