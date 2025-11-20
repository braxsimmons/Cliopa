-- Clean Migration: AI Audit System
-- This script safely drops and recreates everything

-- ============================================================================
-- STEP 1: Drop everything in correct order (dependencies first)
-- ============================================================================

-- Drop views first (they depend on tables)
DROP VIEW IF EXISTS public.agent_performance_summary CASCADE;

-- Drop triggers
DROP TRIGGER IF EXISTS update_calls_updated_at ON public.calls CASCADE;
DROP TRIGGER IF EXISTS update_report_cards_updated_at ON public.report_cards CASCADE;
DROP TRIGGER IF EXISTS update_audit_templates_updated_at ON public.audit_templates CASCADE;

-- Drop functions
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;

-- Drop tables (in reverse dependency order)
DROP TABLE IF EXISTS public.audit_cache CASCADE;
DROP TABLE IF EXISTS public.report_cards CASCADE;
DROP TABLE IF EXISTS public.calls CASCADE;
DROP TABLE IF EXISTS public.audit_templates CASCADE;

-- ============================================================================
-- STEP 2: Create updated_at trigger function
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 3: Create CALLS table
-- ============================================================================

CREATE TABLE public.calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- Five9 Call Metadata
  call_id TEXT UNIQUE,
  campaign_name TEXT,
  call_type TEXT,
  call_start_time TIMESTAMPTZ,
  call_end_time TIMESTAMPTZ,
  call_duration_seconds INTEGER,

  -- Recording & Transcript
  recording_url TEXT,
  transcript_text TEXT,
  transcript_url TEXT,

  -- Customer Info
  customer_phone TEXT,
  customer_name TEXT,

  -- Call Outcome
  disposition TEXT,

  -- Processing Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'transcribed', 'audited', 'failed')),
  audit_id UUID,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_calls_user_id ON public.calls(user_id);
CREATE INDEX idx_calls_status ON public.calls(status);
CREATE INDEX idx_calls_created_at ON public.calls(created_at DESC);

-- Create trigger
CREATE TRIGGER update_calls_updated_at
  BEFORE UPDATE ON public.calls
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own calls"
  ON public.calls FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Managers can view all calls"
  ON public.calls FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Service role can manage all calls"
  ON public.calls FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- ============================================================================
-- STEP 4: Create REPORT_CARDS table
-- ============================================================================

CREATE TABLE public.report_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  call_id UUID REFERENCES public.calls(id) ON DELETE SET NULL,

  -- Source tracking
  source_file TEXT,
  source_type TEXT DEFAULT 'call' CHECK (source_type IN ('call', 'manual_upload', 'transcript')),

  -- Overall score
  overall_score NUMERIC(5, 2) NOT NULL CHECK (overall_score >= 0 AND overall_score <= 100),

  -- Dimensional scores
  communication_score NUMERIC(5, 2) CHECK (communication_score >= 0 AND communication_score <= 100),
  compliance_score NUMERIC(5, 2) CHECK (compliance_score >= 0 AND compliance_score <= 100),
  accuracy_score NUMERIC(5, 2) CHECK (accuracy_score >= 0 AND accuracy_score <= 100),
  tone_score NUMERIC(5, 2) CHECK (tone_score >= 0 AND tone_score <= 100),
  empathy_score NUMERIC(5, 2) CHECK (empathy_score >= 0 AND empathy_score <= 100),
  resolution_score NUMERIC(5, 2) CHECK (resolution_score >= 0 AND resolution_score <= 100),

  -- Feedback & recommendations
  feedback TEXT,
  strengths TEXT[],
  areas_for_improvement TEXT[],
  recommendations TEXT[],

  -- Detailed criteria results (JSONB)
  criteria_results JSONB,

  -- AI metadata
  ai_model TEXT,
  ai_provider TEXT,
  processing_time_ms INTEGER,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_report_cards_user_id ON public.report_cards(user_id);
CREATE INDEX idx_report_cards_call_id ON public.report_cards(call_id);
CREATE INDEX idx_report_cards_created_at ON public.report_cards(created_at DESC);
CREATE INDEX idx_report_cards_overall_score ON public.report_cards(overall_score DESC);

-- Create trigger
CREATE TRIGGER update_report_cards_updated_at
  BEFORE UPDATE ON public.report_cards
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.report_cards ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own report cards"
  ON public.report_cards FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Managers can view all report cards"
  ON public.report_cards FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Managers can insert report cards"
  ON public.report_cards FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Service role can manage all report cards"
  ON public.report_cards FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- ============================================================================
-- STEP 5: Create AUDIT_TEMPLATES table
-- ============================================================================

CREATE TABLE public.audit_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  criteria JSONB NOT NULL,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create trigger
CREATE TRIGGER update_audit_templates_updated_at
  BEFORE UPDATE ON public.audit_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.audit_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can view audit templates"
  ON public.audit_templates FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Managers can manage audit templates"
  ON public.audit_templates FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- ============================================================================
-- STEP 6: Create AUDIT_CACHE table
-- ============================================================================

CREATE TABLE public.audit_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transcript_hash TEXT UNIQUE NOT NULL,
  audit_result JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_cache_hash ON public.audit_cache(transcript_hash);
CREATE INDEX idx_audit_cache_created_at ON public.audit_cache(created_at DESC);

-- Enable RLS
ALTER TABLE public.audit_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage audit cache"
  ON public.audit_cache FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- ============================================================================
-- STEP 7: Create AGENT_PERFORMANCE_SUMMARY view
-- ============================================================================

CREATE OR REPLACE VIEW public.agent_performance_summary AS
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
    MAX(created_at) AS last_audit_date
  FROM public.report_cards
  WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
  GROUP BY user_id
)
SELECT
  p.id AS user_id,
  p.first_name,
  p.last_name,
  p.email,
  p.team,
  COALESCE(ra.total_audits, 0) AS total_audits,
  ROUND(COALESCE(ra.avg_overall_score, 0), 2) AS avg_overall_score,
  ROUND(COALESCE(ra.avg_communication_score, 0), 2) AS avg_communication_score,
  ROUND(COALESCE(ra.avg_compliance_score, 0), 2) AS avg_compliance_score,
  ROUND(COALESCE(ra.avg_accuracy_score, 0), 2) AS avg_accuracy_score,
  ROUND(COALESCE(ra.avg_tone_score, 0), 2) AS avg_tone_score,
  ROUND(COALESCE(ra.avg_empathy_score, 0), 2) AS avg_empathy_score,
  ROUND(COALESCE(ra.avg_resolution_score, 0), 2) AS avg_resolution_score,
  ra.last_audit_date
FROM public.profiles p
LEFT JOIN recent_audits ra ON ra.user_id = p.id;

-- ============================================================================
-- STEP 8: Insert default audit template (27 TLC criteria)
-- ============================================================================

INSERT INTO public.audit_templates (name, description, is_default, criteria)
VALUES (
  'TLC Default Template',
  'Standard 27-point call quality audit template for TLC Financial Services',
  TRUE,
  '[
    {"id": "QQ", "name": "Qualifying Questions", "description": "Did agent ask proper qualifying questions?", "dimension": "compliance", "weight": 1.0},
    {"id": "VCI", "name": "Verify Customer Information", "description": "Did agent verify customer identity properly?", "dimension": "compliance", "weight": 1.0},
    {"id": "PERMISSION", "name": "Permission to Continue", "description": "Did agent ask permission before proceeding?", "dimension": "compliance", "weight": 1.0},
    {"id": "BANKV", "name": "Bank Verification", "description": "Did agent verify bank information correctly?", "dimension": "compliance", "weight": 1.0},
    {"id": "WHY_SMILE", "name": "Smile & Positive Tone", "description": "Did agent maintain positive, friendly tone?", "dimension": "tone", "weight": 1.0},
    {"id": "WHAT_LISTEN_EXPLORE", "name": "Active Listening", "description": "Did agent actively listen and explore customer needs?", "dimension": "communication", "weight": 1.0},
    {"id": "WHAT_EMPATHY", "name": "Empathy", "description": "Did agent show empathy and understanding?", "dimension": "empathy", "weight": 1.0},
    {"id": "WHERE_RESOLUTION", "name": "Proper Resolution", "description": "Was issue resolved fairly and completely?", "dimension": "resolution", "weight": 1.0},
    {"id": "FOLLOWUP", "name": "Follow-up", "description": "Did agent set expectations for next steps?", "dimension": "resolution", "weight": 1.0},
    {"id": "NOTES", "name": "Accurate Notes", "description": "Were call notes accurate and complete?", "dimension": "accuracy", "weight": 1.0},
    {"id": "CAMPAIGN", "name": "Campaign Compliance", "description": "Did call follow campaign-specific requirements?", "dimension": "compliance", "weight": 1.0},
    {"id": "LOAN_DOCUMENT", "name": "Loan Documentation", "description": "Were loan documents referenced correctly?", "dimension": "accuracy", "weight": 1.0}
  ]'::jsonb
);

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Check that everything was created successfully
DO $$
DECLARE
  table_count INTEGER;
  template_count INTEGER;
BEGIN
  -- Count tables
  SELECT COUNT(*) INTO table_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name IN ('calls', 'report_cards', 'audit_templates', 'audit_cache');

  -- Count default template
  SELECT COUNT(*) INTO template_count
  FROM public.audit_templates
  WHERE is_default = TRUE;

  -- Raise notice with results
  RAISE NOTICE 'Tables created: %', table_count;
  RAISE NOTICE 'Default templates: %', template_count;

  IF table_count = 4 AND template_count = 1 THEN
    RAISE NOTICE 'SUCCESS: AI Audit System migration completed successfully!';
  ELSE
    RAISE WARNING 'INCOMPLETE: Migration may not have completed fully';
  END IF;
END $$;
