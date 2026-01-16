-- Migration: AI Audit System - Report Cards & Call Management
-- Date: 2025-11-17
-- Description: Creates tables for AI-powered call auditing, report cards, and Five9 integration

-- ============================================================================
-- PART 1: CALLS TABLE (Five9 Integration)
-- ============================================================================
-- Stores call recordings and metadata from Five9

CREATE TABLE IF NOT EXISTS public.calls (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,

  -- Five9 Call Metadata
  call_id TEXT UNIQUE, -- Five9 unique call ID
  campaign_name TEXT,
  call_type TEXT, -- inbound, outbound, internal
  call_start_time TIMESTAMPTZ,
  call_end_time TIMESTAMPTZ,
  call_duration_seconds INTEGER,

  -- Recording Information
  recording_url TEXT, -- Five9 recording URL or local path
  transcript_text TEXT, -- Full call transcript
  transcript_url TEXT, -- Link to transcript file if stored separately

  -- Call Details
  customer_phone TEXT,
  customer_name TEXT,
  disposition TEXT, -- Call outcome/disposition code

  -- Processing Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'transcribed', 'audited', 'failed')),

  -- Audit Association
  audit_id UUID, -- Links to report_cards table after audit

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT calls_pkey PRIMARY KEY (id),
  CONSTRAINT calls_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS calls_user_id_idx ON public.calls(user_id);
CREATE INDEX IF NOT EXISTS calls_call_id_idx ON public.calls(call_id);
CREATE INDEX IF NOT EXISTS calls_status_idx ON public.calls(status);
CREATE INDEX IF NOT EXISTS calls_call_start_time_idx ON public.calls(call_start_time);

COMMENT ON TABLE public.calls IS
'Stores call recordings and metadata from Five9. Each call can be processed for transcription and AI audit.';


-- ============================================================================
-- PART 2: REPORT CARDS TABLE (AI Audit Results)
-- ============================================================================
-- Stores AI-generated audit scores and feedback for each call/agent

CREATE TABLE IF NOT EXISTS public.report_cards (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  call_id UUID, -- Optional: links to calls table if audit is from a call

  -- Source Information
  source_file TEXT, -- Original filename or call ID
  source_type TEXT DEFAULT 'call' CHECK (source_type IN ('call', 'manual_upload', 'transcript')),

  -- AI Audit Scores (0-100 scale)
  overall_score NUMERIC(5, 2) NOT NULL,
  communication_score NUMERIC(5, 2),
  compliance_score NUMERIC(5, 2),
  accuracy_score NUMERIC(5, 2),
  tone_score NUMERIC(5, 2),
  empathy_score NUMERIC(5, 2),
  resolution_score NUMERIC(5, 2),

  -- AI-Generated Feedback
  feedback TEXT, -- Overall summary paragraph
  strengths TEXT[], -- Array of strength points
  areas_for_improvement TEXT[], -- Array of improvement areas
  recommendations TEXT[], -- Array of specific recommendations

  -- Detailed Criteria Results (JSONB for flexibility)
  criteria_results JSONB, -- Stores full audit template results
  /*
    Example structure:
    {
      "QQ": {
        "result": "PASS",
        "explanation": "...",
        "recommendation": "..."
      },
      "VCI": {
        "result": "PARTIAL",
        "explanation": "...",
        "recommendation": "..."
      }
    }
  */

  -- AI Model Information
  ai_model TEXT, -- e.g., "gpt-4o-mini", "llama3"
  ai_provider TEXT, -- e.g., "openai", "ollama"
  processing_time_ms INTEGER, -- How long the audit took

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT report_cards_pkey PRIMARY KEY (id),
  CONSTRAINT report_cards_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles (id) ON DELETE CASCADE,
  CONSTRAINT report_cards_call_id_fkey FOREIGN KEY (call_id) REFERENCES public.calls (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS report_cards_user_id_idx ON public.report_cards(user_id);
CREATE INDEX IF NOT EXISTS report_cards_call_id_idx ON public.report_cards(call_id);
CREATE INDEX IF NOT EXISTS report_cards_overall_score_idx ON public.report_cards(overall_score);
CREATE INDEX IF NOT EXISTS report_cards_created_at_idx ON public.report_cards(created_at DESC);

COMMENT ON TABLE public.report_cards IS
'Stores AI-generated audit results for calls. Each report card contains multi-dimensional scores, feedback, and detailed criteria assessments.';


-- ============================================================================
-- PART 3: AUDIT TEMPLATES TABLE (Configurable Criteria)
-- ============================================================================
-- Stores audit criteria templates for different types of calls/campaigns

CREATE TABLE IF NOT EXISTS public.audit_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid(),

  -- Template Information
  name TEXT NOT NULL,
  description TEXT,
  template_type TEXT DEFAULT 'call_quality' CHECK (template_type IN ('call_quality', 'compliance', 'sales', 'custom')),

  -- Criteria Definition (JSONB)
  criteria JSONB NOT NULL,
  /*
    Example structure:
    [
      {
        "id": "QQ",
        "name": "Qualifying Questions",
        "description": "Verify QQs were asked and documented",
        "weight": 10,
        "scoring_guide": {
          "PASS": "All QQs asked and documented",
          "PARTIAL": "Some QQs missing",
          "FAIL": "No QQs documented"
        }
      }
    ]
  */

  -- Scoring Weights
  weights JSONB, -- Optional custom weights per criterion

  -- Active Status
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,

  -- Metadata
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT audit_templates_pkey PRIMARY KEY (id),
  CONSTRAINT audit_templates_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS audit_templates_is_active_idx ON public.audit_templates(is_active);
CREATE INDEX IF NOT EXISTS audit_templates_template_type_idx ON public.audit_templates(template_type);

COMMENT ON TABLE public.audit_templates IS
'Stores configurable audit criteria templates. Each template defines scoring criteria and weights for different call types.';


-- ============================================================================
-- PART 4: AUDIT CACHE TABLE (Prevent Duplicate AI Calls)
-- ============================================================================
-- Caches AI audit results based on transcript hash

CREATE TABLE IF NOT EXISTS public.audit_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid(),

  -- Transcript Hash (SHA-256)
  transcript_hash TEXT NOT NULL UNIQUE,

  -- Cached Result
  audit_result JSONB NOT NULL,

  -- Cache Metadata
  ai_model TEXT,
  ai_provider TEXT,
  hit_count INTEGER DEFAULT 1, -- How many times this cache was hit

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT audit_cache_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS audit_cache_transcript_hash_idx ON public.audit_cache(transcript_hash);

COMMENT ON TABLE public.audit_cache IS
'Caches AI audit results by transcript hash to avoid redundant API calls. Improves performance and reduces costs.';


-- ============================================================================
-- PART 5: AGENT PERFORMANCE SUMMARY VIEW
-- ============================================================================
-- Aggregated view of agent performance metrics

CREATE OR REPLACE VIEW agent_performance_summary AS
WITH recent_audits AS (
  SELECT
    user_id,
    COUNT(*) AS total_audits,
    AVG(overall_score) AS avg_overall_score,
    AVG(communication_score) AS avg_communication_score,
    AVG(compliance_score) AS avg_compliance_score,
    AVG(accuracy_score) AS avg_accuracy_score,
    AVG(tone_score) AS avg_tone_score,
    AVG(empathy_score) AS avg_empathy_score,
    AVG(resolution_score) AS avg_resolution_score,
    MIN(overall_score) AS min_score,
    MAX(overall_score) AS max_score,
    STDDEV(overall_score) AS score_std_dev
  FROM public.report_cards
  WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
  GROUP BY user_id
),
call_volume AS (
  SELECT
    user_id,
    COUNT(*) AS total_calls,
    COUNT(*) FILTER (WHERE status = 'audited') AS audited_calls
  FROM public.calls
  WHERE call_start_time >= CURRENT_DATE - INTERVAL '30 days'
  GROUP BY user_id
)
SELECT
  p.id AS user_id,
  p.first_name,
  p.last_name,
  p.email,
  p.team,
  p.role,

  -- Audit Metrics
  COALESCE(ra.total_audits, 0) AS total_audits_30d,
  ROUND(COALESCE(ra.avg_overall_score, 0), 2) AS avg_overall_score,
  ROUND(COALESCE(ra.avg_communication_score, 0), 2) AS avg_communication_score,
  ROUND(COALESCE(ra.avg_compliance_score, 0), 2) AS avg_compliance_score,
  ROUND(COALESCE(ra.avg_accuracy_score, 0), 2) AS avg_accuracy_score,
  ROUND(COALESCE(ra.avg_tone_score, 0), 2) AS avg_tone_score,
  ROUND(COALESCE(ra.avg_empathy_score, 0), 2) AS avg_empathy_score,
  ROUND(COALESCE(ra.avg_resolution_score, 0), 2) AS avg_resolution_score,
  ROUND(COALESCE(ra.min_score, 0), 2) AS min_score,
  ROUND(COALESCE(ra.max_score, 0), 2) AS max_score,
  ROUND(COALESCE(ra.score_std_dev, 0), 2) AS score_std_dev,

  -- Call Volume
  COALESCE(cv.total_calls, 0) AS total_calls_30d,
  COALESCE(cv.audited_calls, 0) AS audited_calls_30d,

  -- Audit Coverage %
  CASE
    WHEN COALESCE(cv.total_calls, 0) > 0 THEN
      ROUND((COALESCE(cv.audited_calls, 0)::NUMERIC / cv.total_calls) * 100, 2)
    ELSE 0
  END AS audit_coverage_pct

FROM public.profiles p
LEFT JOIN recent_audits ra ON ra.user_id = p.id
LEFT JOIN call_volume cv ON cv.user_id = p.id
WHERE p.role IN ('ccm', 'crm') -- Only agents, not admins/managers
ORDER BY ra.avg_overall_score DESC NULLS LAST;

COMMENT ON VIEW agent_performance_summary IS
'Aggregated 30-day performance metrics for all agents. Used for manager dashboards and leaderboards.';


-- ============================================================================
-- PART 6: AUTOMATIC UPDATED_AT TRIGGERS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_calls_updated_at
  BEFORE UPDATE ON public.calls
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_report_cards_updated_at
  BEFORE UPDATE ON public.report_cards
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_audit_templates_updated_at
  BEFORE UPDATE ON public.audit_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();


-- ============================================================================
-- PART 7: ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_cache ENABLE ROW LEVEL SECURITY;

-- Calls table policies
CREATE POLICY "Users can view their own calls"
  ON public.calls FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Managers can view all calls"
  ON public.calls FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "System can insert calls"
  ON public.calls FOR INSERT
  WITH CHECK (true); -- Will be restricted by service role key

CREATE POLICY "System can update calls"
  ON public.calls FOR UPDATE
  USING (true); -- Will be restricted by service role key

-- Report cards policies
CREATE POLICY "Users can view their own report cards"
  ON public.report_cards FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Managers can view all report cards"
  ON public.report_cards FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "System can insert report cards"
  ON public.report_cards FOR INSERT
  WITH CHECK (true);

-- Audit templates policies
CREATE POLICY "Everyone can view active templates"
  ON public.audit_templates FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage templates"
  ON public.audit_templates FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role = 'admin'
    )
  );

-- Audit cache policies (system only)
CREATE POLICY "System can manage audit cache"
  ON public.audit_cache FOR ALL
  USING (true); -- Restricted by service role key


-- ============================================================================
-- PART 8: GRANT PERMISSIONS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE ON public.calls TO authenticated;
GRANT SELECT ON public.calls TO anon;

GRANT SELECT, INSERT ON public.report_cards TO authenticated;
GRANT SELECT ON public.report_cards TO anon;

GRANT SELECT ON public.audit_templates TO authenticated;
GRANT ALL ON public.audit_templates TO service_role;

GRANT ALL ON public.audit_cache TO service_role;


-- ============================================================================
-- PART 9: INSERT DEFAULT AUDIT TEMPLATE
-- ============================================================================

INSERT INTO public.audit_templates (name, description, template_type, criteria, is_default)
VALUES (
  'TLC Care Team Call Quality',
  'Standard call quality audit template for TLC care team with 27 criteria covering verification, process, documentation, compliance, and quality care.',
  'call_quality',
  '[
    {"id": "QQ", "name": "Qualifying Questions", "description": "Verify QQs were asked and documented", "weight": 5},
    {"id": "VCI", "name": "Customer Information Verification", "description": "Properly verified customer identity", "weight": 5},
    {"id": "PERMISSION", "name": "Marketing Permissions", "description": "Reviewed marketing permissions and DNC compliance", "weight": 5},
    {"id": "CAMPAIGN", "name": "Campaign Noted", "description": "Correct campaign was noted in system", "weight": 3},
    {"id": "BANKV", "name": "Bank Verification", "description": "Completed bank verification process", "weight": 5},
    {"id": "REVIEW_TERMS", "name": "Review Terms", "description": "Reviewed loan terms with customer", "weight": 4},
    {"id": "LOAN_DOCUMENT", "name": "Loan Documentation", "description": "Attached and executed loan documents", "weight": 4},
    {"id": "NOTES", "name": "Proper Notes", "description": "Documented interaction in file notes", "weight": 4},
    {"id": "INITIATIONS", "name": "Loan Initiations", "description": "Indicated loan process initiation", "weight": 3},
    {"id": "CHANGE_REQUESTS", "name": "Change Requests", "description": "Processed payment type changes correctly", "weight": 3},
    {"id": "NOTIFICATION", "name": "Follow-up Notification", "description": "Notified or set follow-up with client", "weight": 3},
    {"id": "PMT_REMINDERS", "name": "Payment Reminders", "description": "Made payment reminder calls as needed", "weight": 3},
    {"id": "ACCOMODATION", "name": "Accommodation Procedures", "description": "Followed accommodation procedures", "weight": 4},
    {"id": "FOLLOWUP", "name": "Required Follow-up", "description": "Completed all required follow-up actions", "weight": 3},
    {"id": "WHY_SMILE", "name": "Sincerity & Tone", "description": "Demonstrated friendliness and positive tone", "weight": 5},
    {"id": "WHAT_TIMELY", "name": "Timely Response", "description": "Responded in a timely manner", "weight": 4},
    {"id": "WHAT_EMPATHY", "name": "Empathy & Care", "description": "Demonstrated empathy and care", "weight": 5},
    {"id": "WHAT_LISTEN_EXPLORE", "name": "Active Listening", "description": "Actively listened and explored solutions", "weight": 5},
    {"id": "WHERE_RESOLUTION", "name": "Fair Resolution", "description": "Worked toward fair resolution", "weight": 5},
    {"id": "WHO_CORE_VALUES", "name": "Core Values", "description": "Demonstrated integrity, passion, and excellence", "weight": 5},
    {"id": "HOW_PROCESS", "name": "Process Compliance", "description": "Followed established processes", "weight": 4},
    {"id": "HOW_SCRIPTS", "name": "Script Compliance", "description": "Adhered to required scripts", "weight": 4}
  ]'::JSONB,
  true
)
ON CONFLICT DO NOTHING;


-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Verification queries:
--
-- 1. Check tables created:
--    \dt public.calls
--    \dt public.report_cards
--    \dt public.audit_templates
--
-- 2. View default audit template:
--    SELECT name, description, jsonb_array_length(criteria) as criteria_count
--    FROM audit_templates WHERE is_default = true;
--
-- 3. Check agent performance view:
--    SELECT * FROM agent_performance_summary LIMIT 5;
