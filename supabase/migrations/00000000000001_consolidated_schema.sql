-- ============================================================================
-- CONSOLIDATED SCHEMA MIGRATION
-- Created: 2026-01-16
-- Description: Single consolidated migration for fresh Supabase installations
-- ============================================================================

-- ============================================================================
-- PART 1: TYPES AND ENUMS
-- ============================================================================

DO $$ BEGIN
    CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'ccm', 'crm');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public.rule_unit AS ENUM ('DAY', 'MONTH', 'YEAR');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public.notification_type AS ENUM (
        'time_off_approved',
        'time_off_denied',
        'time_correction_approved',
        'time_correction_denied',
        'shift_reminder',
        'audit_completed',
        'report_card_available',
        'system_announcement',
        'shift_needs_approval',
        'performance_alert',
        'coaching_session',
        'goal_update'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- PART 2: BASE TABLES (No Foreign Key Dependencies)
-- ============================================================================

-- Holidays table
CREATE TABLE IF NOT EXISTS public.holidays (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    holiday_date DATE NOT NULL,
    holiday_name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT holidays_pkey PRIMARY KEY (id),
    CONSTRAINT holidays_holiday_date_key UNIQUE (holiday_date)
);

-- Pay periods table
CREATE TABLE IF NOT EXISTS public.pay_periods (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    period_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT pay_periods_pkey PRIMARY KEY (id),
    CONSTRAINT pay_periods_period_type_check CHECK (period_type = ANY(ARRAY['first_half', 'second_half'])),
    CONSTRAINT pay_periods_status_check CHECK (status = ANY(ARRAY['open', 'processing', 'closed']))
);

-- Time off rules table
CREATE TABLE IF NOT EXISTS public.time_off_rules (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    name TEXT NOT NULL DEFAULT '',
    value NUMERIC NOT NULL DEFAULT 0,
    reset_period NUMERIC NOT NULL DEFAULT 0,
    reset_unit public.rule_unit NOT NULL,
    not_before NUMERIC NOT NULL DEFAULT 0,
    not_before_unit public.rule_unit NOT NULL,
    team TEXT NOT NULL DEFAULT '',
    progression UUID,
    CONSTRAINT time_off_rules_pkey PRIMARY KEY (id)
);

-- ============================================================================
-- PART 3: PROFILES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID NOT NULL,
    email TEXT NOT NULL,
    first_name TEXT NULL,
    last_name TEXT NULL,
    role public.app_role NOT NULL,
    hourly_rate NUMERIC(10, 2) NOT NULL DEFAULT 15.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    start_date DATE NULL,
    birthday DATE NULL,
    team TEXT NULL,
    pto_rule UUID DEFAULT NULL,
    uto_rule UUID DEFAULT NULL,
    pto_rule_advance_at DATE NULL,
    employment_type TEXT NOT NULL DEFAULT 'Full-Time',
    CONSTRAINT profiles_pkey PRIMARY KEY (id),
    CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users (id) ON DELETE CASCADE,
    CONSTRAINT pto_rule_fkey FOREIGN KEY (pto_rule) REFERENCES public.time_off_rules(id),
    CONSTRAINT uto_rule_fkey FOREIGN KEY (uto_rule) REFERENCES public.time_off_rules(id)
);

-- ============================================================================
-- PART 4: DEPENDENT TABLES
-- ============================================================================

-- Early clock attempts
CREATE TABLE IF NOT EXISTS public.early_clock_attempts (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    attempted_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    scheduled_start TIMESTAMPTZ NOT NULL,
    actual_clock_in TIMESTAMPTZ NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    team TEXT NOT NULL DEFAULT '',
    shift_type TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT early_clock_attempts_pkey PRIMARY KEY (id),
    CONSTRAINT early_clock_attempts_status_check CHECK (status = ANY(ARRAY['pending', 'completed', 'cancelled']))
);

-- KPIs table
CREATE TABLE IF NOT EXISTS public.kpis (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    metric_name TEXT NOT NULL,
    metric_value NUMERIC(10, 2) NOT NULL,
    bonus_amount NUMERIC(10, 2) NULL DEFAULT 0.00,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT kpis_pkey PRIMARY KEY (id),
    CONSTRAINT kpis_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE
);

-- Payroll calculations
CREATE TABLE IF NOT EXISTS public.payroll_calculations (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    pay_period_id UUID NOT NULL,
    regular_hours NUMERIC NOT NULL DEFAULT 0,
    overtime_hours NUMERIC NOT NULL DEFAULT 0,
    holiday_hours NUMERIC NOT NULL DEFAULT 0,
    pto_hours NUMERIC NOT NULL DEFAULT 0,
    hourly_rate NUMERIC NOT NULL,
    regular_pay NUMERIC NOT NULL DEFAULT 0,
    overtime_pay NUMERIC NOT NULL DEFAULT 0,
    holiday_pay NUMERIC NOT NULL DEFAULT 0,
    pto_pay NUMERIC NOT NULL DEFAULT 0,
    total_gross_pay NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT payroll_calculations_pkey PRIMARY KEY (id),
    CONSTRAINT payroll_calculations_user_id_pay_period_id_key UNIQUE (user_id, pay_period_id),
    CONSTRAINT payroll_calculations_pay_period_id_fkey FOREIGN KEY (pay_period_id) REFERENCES pay_periods (id)
);

-- Time entries
CREATE TABLE IF NOT EXISTS public.time_entries (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NULL,
    total_hours NUMERIC(10, 2) NULL,
    status TEXT NOT NULL DEFAULT 'active',
    team TEXT NOT NULL DEFAULT '',
    shift_type TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    verified TIMESTAMPTZ,
    CONSTRAINT time_entries_pkey PRIMARY KEY (id),
    CONSTRAINT time_entries_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles (id) ON DELETE CASCADE,
    CONSTRAINT time_entries_status_check CHECK (status = ANY(ARRAY['active', 'completed']))
);

CREATE UNIQUE INDEX IF NOT EXISTS one_active_time_entry_per_user
    ON public.time_entries (user_id)
    WHERE status = 'active';

-- Time off requests
CREATE TABLE IF NOT EXISTS public.time_off_requests (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    request_type TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    days_requested NUMERIC NOT NULL,
    reason TEXT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    approved_by UUID NULL,
    approved_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    approval_notes TEXT NULL,
    CONSTRAINT time_off_requests_pkey PRIMARY KEY (id),
    CONSTRAINT time_off_requests_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.profiles (id),
    CONSTRAINT time_off_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles (id) ON DELETE CASCADE,
    CONSTRAINT time_off_requests_request_type_check CHECK (request_type = ANY(ARRAY['PTO', 'UTO'])),
    CONSTRAINT time_off_requests_status_check CHECK (status = ANY(ARRAY['pending', 'approved', 'denied', 'exception']))
);

CREATE INDEX IF NOT EXISTS idx_time_off_requests_user_id ON public.time_off_requests USING BTREE (user_id);
CREATE INDEX IF NOT EXISTS idx_time_off_requests_status ON public.time_off_requests USING BTREE (status);

-- Approved time off
CREATE TABLE IF NOT EXISTS public.approved_time_off (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    request_id UUID NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    days_taken NUMERIC NOT NULL,
    request_type TEXT NOT NULL,
    hourly_rate NUMERIC NULL,
    total_pay NUMERIC GENERATED ALWAYS AS (
        CASE
            WHEN (request_type = 'PTO') THEN ((days_taken * 8) * hourly_rate)
            ELSE 0
        END
    ) STORED NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT approved_time_off_pkey PRIMARY KEY (id),
    CONSTRAINT approved_time_off_request_id_fkey FOREIGN KEY (request_id) REFERENCES time_off_requests (id) ON DELETE CASCADE,
    CONSTRAINT approved_time_off_request_type_check CHECK (request_type = ANY(ARRAY['PTO', 'UTO']))
);

CREATE INDEX IF NOT EXISTS idx_approved_time_off_user_date ON public.approved_time_off USING BTREE (user_id, start_date, end_date);

-- Employee shifts
CREATE TABLE IF NOT EXISTS public.employee_shifts (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    day_of_week INTEGER NOT NULL,
    is_working_day BOOLEAN NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    morning_start TIME WITHOUT TIME ZONE NULL,
    morning_end TIME WITHOUT TIME ZONE NULL,
    afternoon_start TIME WITHOUT TIME ZONE NULL,
    afternoon_end TIME WITHOUT TIME ZONE NULL,
    CONSTRAINT employee_shifts_pkey PRIMARY KEY (id),
    CONSTRAINT employee_shifts_user_id_day_of_week_key UNIQUE (user_id, day_of_week),
    CONSTRAINT employee_shifts_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles (id) ON DELETE CASCADE,
    CONSTRAINT employee_shifts_day_of_week_check CHECK ((day_of_week >= 0) AND (day_of_week <= 6))
);

-- Time corrections
CREATE TABLE IF NOT EXISTS public.time_corrections (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    time_entry_id UUID NOT NULL,
    requested_start_time TIMESTAMPTZ,
    requested_end_time TIMESTAMPTZ,
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    team TEXT,
    shift_type TEXT,
    approved_by UUID NULL,
    approved_at TIMESTAMPTZ NULL,
    review_notes TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT time_corrections_pkey PRIMARY KEY (id),
    CONSTRAINT time_corrections_time_entry_id_fkey FOREIGN KEY (time_entry_id) REFERENCES public.time_entries (id) ON DELETE CASCADE,
    CONSTRAINT time_corrections_status_check CHECK (status = ANY(ARRAY['pending', 'approved', 'denied']))
);

-- Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    type public.notification_type NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    read BOOLEAN DEFAULT FALSE,
    action_url TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- ============================================================================
-- PART 5: AI AUDIT SYSTEM TABLES
-- ============================================================================

-- Calls table (Five9 Integration)
CREATE TABLE IF NOT EXISTS public.calls (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    call_id TEXT UNIQUE,
    campaign_name TEXT,
    call_type TEXT,
    call_start_time TIMESTAMPTZ,
    call_end_time TIMESTAMPTZ,
    call_duration_seconds INTEGER,
    recording_url TEXT,
    transcript_text TEXT,
    transcript_url TEXT,
    customer_phone TEXT,
    customer_name TEXT,
    disposition TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'transcribed', 'audited', 'failed')),
    audit_id UUID,
    is_bookmarked BOOLEAN DEFAULT false,
    notes TEXT,
    summary_url TEXT,
    summary_text TEXT,
    processing_status TEXT DEFAULT 'pending' CHECK (processing_status IN ('pending', 'queued', 'processing', 'completed', 'failed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT calls_pkey PRIMARY KEY (id),
    CONSTRAINT calls_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS calls_user_id_idx ON public.calls(user_id);
CREATE INDEX IF NOT EXISTS calls_call_id_idx ON public.calls(call_id);
CREATE INDEX IF NOT EXISTS calls_status_idx ON public.calls(status);
CREATE INDEX IF NOT EXISTS calls_call_start_time_idx ON public.calls(call_start_time);
CREATE INDEX IF NOT EXISTS idx_calls_bookmarked ON calls(is_bookmarked) WHERE is_bookmarked = true;
CREATE INDEX IF NOT EXISTS idx_calls_has_summary ON calls(id) WHERE summary_text IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_calls_processing_status ON calls(processing_status) WHERE processing_status IN ('pending', 'queued');
CREATE INDEX IF NOT EXISTS idx_calls_pending_audit ON calls(status, created_at) WHERE status = 'pending' OR status = 'transcribed';

-- Report cards table
CREATE TABLE IF NOT EXISTS public.report_cards (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    call_id UUID,
    source_file TEXT,
    source_type TEXT DEFAULT 'call' CHECK (source_type IN ('call', 'manual_upload', 'transcript')),
    overall_score NUMERIC(5, 2) NOT NULL,
    communication_score NUMERIC(5, 2),
    compliance_score NUMERIC(5, 2),
    accuracy_score NUMERIC(5, 2),
    tone_score NUMERIC(5, 2),
    empathy_score NUMERIC(5, 2),
    resolution_score NUMERIC(5, 2),
    feedback TEXT,
    strengths TEXT[],
    areas_for_improvement TEXT[],
    recommendations TEXT[],
    criteria_results JSONB,
    ai_model TEXT,
    ai_provider TEXT,
    processing_time_ms INTEGER,
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

-- Audit templates table
CREATE TABLE IF NOT EXISTS public.audit_templates (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    template_type TEXT DEFAULT 'call_quality' CHECK (template_type IN ('call_quality', 'compliance', 'sales', 'custom')),
    criteria JSONB NOT NULL,
    weights JSONB,
    is_active BOOLEAN DEFAULT true,
    is_default BOOLEAN DEFAULT false,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT audit_templates_pkey PRIMARY KEY (id),
    CONSTRAINT audit_templates_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS audit_templates_is_active_idx ON public.audit_templates(is_active);
CREATE INDEX IF NOT EXISTS audit_templates_template_type_idx ON public.audit_templates(template_type);

-- Audit cache table
CREATE TABLE IF NOT EXISTS public.audit_cache (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    transcript_hash TEXT NOT NULL UNIQUE,
    audit_result JSONB NOT NULL,
    ai_model TEXT,
    ai_provider TEXT,
    hit_count INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT audit_cache_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS audit_cache_transcript_hash_idx ON public.audit_cache(transcript_hash);

-- ============================================================================
-- PART 6: ADDITIONAL SYSTEM TABLES
-- ============================================================================

-- Company settings
CREATE TABLE IF NOT EXISTS public.company_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value JSONB NOT NULL,
    description TEXT,
    updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Announcements
CREATE TABLE IF NOT EXISTS public.announcements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    target_audience VARCHAR(50) DEFAULT 'all' CHECK (target_audience IN ('all', 'managers', 'employees')),
    target_team VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    starts_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_announcements_active ON announcements(is_active, starts_at, expires_at);

-- Audit log
CREATE TABLE IF NOT EXISTS public.audit_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at DESC);

-- Scheduled shifts
CREATE TABLE IF NOT EXISTS public.scheduled_shifts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    scheduled_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    shift_type VARCHAR(50) DEFAULT 'regular',
    team VARCHAR(100),
    notes TEXT,
    status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled', 'no_show')),
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scheduled_shifts_user_id ON scheduled_shifts(user_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_shifts_date ON scheduled_shifts(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_scheduled_shifts_user_date ON scheduled_shifts(user_id, scheduled_date);

-- Dashboard embeds (Metabase)
CREATE TABLE IF NOT EXISTS public.dashboard_embeds (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    url TEXT NOT NULL,
    icon VARCHAR(50) DEFAULT 'BarChart3',
    category VARCHAR(50) DEFAULT 'general',
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dashboard_embeds_order ON dashboard_embeds(category, display_order);
CREATE INDEX IF NOT EXISTS idx_dashboard_embeds_active ON dashboard_embeds(is_active);

-- ============================================================================
-- PART 7: COACHING & ALERTS SYSTEM
-- ============================================================================

-- Coaching sessions
CREATE TABLE IF NOT EXISTS public.coaching_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    agent_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    coach_id UUID NOT NULL REFERENCES profiles(id) ON DELETE SET NULL,
    session_type VARCHAR(50) NOT NULL CHECK (session_type IN ('one_on_one', 'group', 'self_review', 'performance_review', 'skill_development')),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled', 'no_show')),
    scheduled_at TIMESTAMPTZ NOT NULL,
    duration_minutes INTEGER DEFAULT 30,
    completed_at TIMESTAMPTZ,
    related_call_id UUID REFERENCES calls(id) ON DELETE SET NULL,
    related_report_card_id UUID REFERENCES report_cards(id) ON DELETE SET NULL,
    agenda JSONB DEFAULT '[]',
    notes TEXT,
    action_items JSONB DEFAULT '[]',
    agent_feedback TEXT,
    coach_feedback TEXT,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coaching_agent ON coaching_sessions(agent_id);
CREATE INDEX IF NOT EXISTS idx_coaching_coach ON coaching_sessions(coach_id);
CREATE INDEX IF NOT EXISTS idx_coaching_status ON coaching_sessions(status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_coaching_scheduled ON coaching_sessions(scheduled_at);

-- Agent goals
CREATE TABLE IF NOT EXISTS public.agent_goals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    agent_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL CHECK (category IN ('quality', 'efficiency', 'compliance', 'communication', 'development', 'custom')),
    metric_type VARCHAR(50) NOT NULL CHECK (metric_type IN ('score', 'count', 'percentage', 'time', 'custom')),
    target_value DECIMAL(10, 2) NOT NULL,
    current_value DECIMAL(10, 2) DEFAULT 0,
    baseline_value DECIMAL(10, 2),
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    target_date DATE NOT NULL,
    completed_date DATE,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'missed', 'cancelled')),
    priority VARCHAR(10) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
    milestones JSONB DEFAULT '[]',
    progress_history JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_goals_agent ON agent_goals(agent_id);
CREATE INDEX IF NOT EXISTS idx_goals_status ON agent_goals(status, target_date);
CREATE INDEX IF NOT EXISTS idx_goals_category ON agent_goals(category);

-- Performance alerts
CREATE TABLE IF NOT EXISTS public.performance_alerts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    alert_type VARCHAR(50) NOT NULL CHECK (alert_type IN (
        'low_score', 'score_drop', 'compliance_violation',
        'goal_at_risk', 'goal_achieved', 'streak_broken',
        'improvement_needed', 'excellent_performance',
        'coaching_due', 'review_needed'
    )),
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('info', 'warning', 'critical', 'success')),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    related_entity_type VARCHAR(50),
    related_entity_id UUID,
    metadata JSONB DEFAULT '{}',
    is_read BOOLEAN DEFAULT false,
    is_acknowledged BOOLEAN DEFAULT false,
    acknowledged_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    acknowledged_at TIMESTAMPTZ,
    action_url VARCHAR(500),
    action_label VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_alerts_user ON performance_alerts(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_alerts_type ON performance_alerts(alert_type, severity);
CREATE INDEX IF NOT EXISTS idx_alerts_created ON performance_alerts(created_at DESC);

-- ============================================================================
-- PART 8: CALL LIBRARY & DISPUTE SYSTEM
-- ============================================================================

-- Call tags master
CREATE TABLE IF NOT EXISTS public.call_tags_master (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    color VARCHAR(20) DEFAULT 'blue',
    description TEXT,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Call tags junction
CREATE TABLE IF NOT EXISTS public.call_tags (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    call_id UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES call_tags_master(id) ON DELETE CASCADE,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(call_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_call_tags_call ON call_tags(call_id);
CREATE INDEX IF NOT EXISTS idx_call_tags_tag ON call_tags(tag_id);

-- Call collections
CREATE TABLE IF NOT EXISTS public.call_collections (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_public BOOLEAN DEFAULT false,
    created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_collections_creator ON call_collections(created_by);

-- Collection calls junction
CREATE TABLE IF NOT EXISTS public.collection_calls (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    collection_id UUID NOT NULL REFERENCES call_collections(id) ON DELETE CASCADE,
    call_id UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
    added_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(collection_id, call_id)
);

CREATE INDEX IF NOT EXISTS idx_collection_calls_collection ON collection_calls(collection_id);
CREATE INDEX IF NOT EXISTS idx_collection_calls_call ON collection_calls(call_id);

-- Score disputes
CREATE TABLE IF NOT EXISTS public.score_disputes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    report_card_id UUID NOT NULL REFERENCES report_cards(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    dispute_reason TEXT NOT NULL,
    criteria_disputed JSONB DEFAULT '[]',
    supporting_evidence TEXT,
    requested_scores JSONB,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN (
        'pending', 'under_review', 'approved', 'partially_approved', 'rejected', 'withdrawn'
    )),
    priority VARCHAR(10) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    resolution_notes TEXT,
    adjusted_scores JSONB,
    criteria_adjustments JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_disputes_report_card ON score_disputes(report_card_id);
CREATE INDEX IF NOT EXISTS idx_disputes_user ON score_disputes(user_id);
CREATE INDEX IF NOT EXISTS idx_disputes_status ON score_disputes(status);
CREATE INDEX IF NOT EXISTS idx_disputes_reviewer ON score_disputes(reviewed_by);
CREATE INDEX IF NOT EXISTS idx_disputes_created ON score_disputes(created_at DESC);

-- Dispute comments
CREATE TABLE IF NOT EXISTS public.dispute_comments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    dispute_id UUID NOT NULL REFERENCES score_disputes(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    comment TEXT NOT NULL,
    is_internal BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dispute_comments_dispute ON dispute_comments(dispute_id);

-- Dispute history
CREATE TABLE IF NOT EXISTS public.dispute_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    dispute_id UUID NOT NULL REFERENCES score_disputes(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL,
    old_value JSONB,
    new_value JSONB,
    performed_by UUID NOT NULL REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dispute_history_dispute ON dispute_history(dispute_id);
CREATE INDEX IF NOT EXISTS idx_dispute_history_created ON dispute_history(created_at DESC);

-- ============================================================================
-- PART 9: CONVERSATION INTELLIGENCE
-- ============================================================================

-- Keyword libraries
CREATE TABLE IF NOT EXISTS public.keyword_libraries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL CHECK (category IN (
        'compliance', 'prohibited', 'sales', 'empathy',
        'escalation', 'closing', 'greeting', 'custom'
    )),
    keywords JSONB NOT NULL DEFAULT '[]',
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Script templates
CREATE TABLE IF NOT EXISTS public.script_templates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL CHECK (category IN (
        'opening', 'verification', 'negotiation',
        'objection_handling', 'closing', 'compliance', 'full_call'
    )),
    script_content TEXT NOT NULL,
    required_phrases JSONB DEFAULT '[]',
    min_adherence_score INTEGER DEFAULT 70,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Call analytics
CREATE TABLE IF NOT EXISTS public.call_analytics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    call_id UUID REFERENCES calls(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    call_duration_seconds INTEGER,
    agent_talk_time_seconds INTEGER,
    customer_talk_time_seconds INTEGER,
    silence_time_seconds INTEGER,
    talk_to_listen_ratio DECIMAL(4, 2),
    overall_sentiment VARCHAR(20) CHECK (overall_sentiment IN ('positive', 'neutral', 'negative', 'mixed')),
    sentiment_score DECIMAL(4, 2),
    sentiment_timeline JSONB DEFAULT '[]',
    keywords_found JSONB DEFAULT '[]',
    compliance_keywords_found INTEGER DEFAULT 0,
    prohibited_keywords_found INTEGER DEFAULT 0,
    empathy_keywords_found INTEGER DEFAULT 0,
    escalation_triggers_found INTEGER DEFAULT 0,
    script_template_id UUID REFERENCES script_templates(id) ON DELETE SET NULL,
    script_adherence_score DECIMAL(5, 2),
    script_phrases_matched JSONB DEFAULT '[]',
    script_phrases_missed JSONB DEFAULT '[]',
    call_outcome VARCHAR(50) CHECK (call_outcome IN (
        'payment_collected', 'payment_arrangement', 'callback_scheduled',
        'dispute', 'wrong_party', 'refused_to_pay', 'disconnected',
        'voicemail', 'no_contact', 'other'
    )),
    call_topics JSONB DEFAULT '[]',
    customer_intent VARCHAR(50),
    dead_air_count INTEGER DEFAULT 0,
    interruption_count INTEGER DEFAULT 0,
    hold_time_seconds INTEGER DEFAULT 0,
    transfer_count INTEGER DEFAULT 0,
    ai_summary TEXT,
    ai_recommendations JSONB DEFAULT '[]',
    ai_model VARCHAR(50),
    processing_time_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_call_analytics_call ON call_analytics(call_id);
CREATE INDEX IF NOT EXISTS idx_call_analytics_user ON call_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_call_analytics_sentiment ON call_analytics(overall_sentiment);
CREATE INDEX IF NOT EXISTS idx_call_analytics_created ON call_analytics(created_at DESC);

-- ============================================================================
-- PART 10: CALL SYNC TRACKING
-- ============================================================================

-- Sync logs
CREATE TABLE IF NOT EXISTS public.call_sync_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    call_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('success', 'error', 'skipped')),
    error_message TEXT,
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    source TEXT DEFAULT 'sql_server'
);

CREATE INDEX IF NOT EXISTS idx_call_sync_logs_call_id ON call_sync_logs(call_id);
CREATE INDEX IF NOT EXISTS idx_call_sync_logs_synced_at ON call_sync_logs(synced_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_sync_logs_status ON call_sync_logs(status);

-- Sync runs
CREATE TABLE IF NOT EXISTS public.call_sync_runs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    status TEXT DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
    calls_synced INTEGER DEFAULT 0,
    calls_skipped INTEGER DEFAULT 0,
    calls_failed INTEGER DEFAULT 0,
    error_message TEXT,
    source TEXT DEFAULT 'sql_server'
);

CREATE INDEX IF NOT EXISTS idx_call_sync_runs_started_at ON call_sync_runs(started_at DESC);

-- External DB config
CREATE TABLE IF NOT EXISTS public.external_db_config (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    db_type TEXT NOT NULL CHECK (db_type IN ('mssql', 'postgres', 'mysql')),
    config JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    last_sync_at TIMESTAMPTZ,
    sync_interval_minutes INTEGER DEFAULT 15,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- PART 11: CORE FUNCTIONS
-- ============================================================================

-- Update updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Calculate total hours trigger function
CREATE OR REPLACE FUNCTION public.calculate_total_hours()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    IF NEW.end_time IS NOT NULL AND NEW.start_time IS NOT NULL THEN
        NEW.total_hours = EXTRACT(EPOCH FROM (NEW.end_time - NEW.start_time)) / 3600.0;
        NEW.status = 'completed';
    END IF;
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- Update employee shifts updated_at
CREATE OR REPLACE FUNCTION public.update_employee_shifts_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- Handle new user function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
SECURITY DEFINER
AS $$
BEGIN
    WITH uto_id AS (
        SELECT ID FROM public.time_off_rules WHERE name = 'UTO'
    )
    INSERT INTO public.profiles (id, email, first_name, last_name, role, uto_rule)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'role', 'ccm')::public.app_role,
        (SELECT id FROM uto_id)
    );
    RETURN NEW;
END;
$$;

-- Has role function
CREATE OR REPLACE FUNCTION public.has_role(target_role public.app_role, target_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
SET search_path = ''
STABLE
SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = target_user_id AND role = target_role
    );
$$;

-- Has any role function
CREATE OR REPLACE FUNCTION public.has_any_role(target_roles public.app_role[], target_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
SET search_path = ''
STABLE
SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = target_user_id AND role = ANY(target_roles)
    );
$$;

-- Get user roles function
CREATE OR REPLACE FUNCTION public.get_user_roles(target_user_id uuid DEFAULT auth.uid())
RETURNS public.app_role[]
LANGUAGE sql
SET search_path = ''
STABLE
SECURITY DEFINER
AS $$
    SELECT ARRAY_AGG(role) FROM public.profiles WHERE id = target_user_id;
$$;

-- Approve time correction function
CREATE OR REPLACE FUNCTION public.approve_time_correction(
    correction_id uuid,
    approver_id uuid,
    notes text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
    correction_record RECORD;
BEGIN
    SELECT * INTO correction_record
    FROM public.time_corrections
    WHERE id = correction_id AND status = 'pending';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Correction not found or already processed';
    END IF;

    UPDATE public.time_entries
    SET
        start_time = COALESCE(correction_record.requested_start_time, start_time),
        end_time = COALESCE(correction_record.requested_end_time, end_time),
        shift_type = COALESCE(correction_record.shift_type, shift_type),
        total_hours = EXTRACT(EPOCH FROM (
            COALESCE(correction_record.requested_end_time, end_time) -
            COALESCE(correction_record.requested_start_time, start_time)
        )) / 3600,
        updated_at = NOW()
    WHERE id = correction_record.time_entry_id;

    UPDATE public.time_corrections
    SET
        status = 'approved',
        approved_by = approver_id,
        approved_at = NOW(),
        review_notes = notes,
        updated_at = NOW()
    WHERE id = correction_id;

    RETURN TRUE;
END;
$$;

-- Deny time correction function
CREATE OR REPLACE FUNCTION public.deny_time_correction(correction_id uuid, notes text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SET search_path = ''
SECURITY DEFINER
AS $$
DECLARE
    correction_record RECORD;
BEGIN
    SELECT * INTO correction_record
    FROM public.time_corrections
    WHERE id = correction_id AND status = 'pending';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Correction not found or already processed';
    END IF;

    UPDATE public.time_corrections
    SET status = 'denied', review_notes = notes, updated_at = NOW()
    WHERE id = correction_id;

    RETURN TRUE;
END;
$$;

-- Approve time off request function
CREATE OR REPLACE FUNCTION public.approve_time_off_request(request_id uuid, approver_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SET search_path = ''
SECURITY DEFINER
AS $$
DECLARE
    request_record RECORD;
    user_profile RECORD;
BEGIN
    SELECT user_id, start_date, end_date, days_requested, request_type
    INTO request_record
    FROM public.time_off_requests
    WHERE id = request_id AND status = 'pending';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Request not found or already processed';
    END IF;

    SELECT hourly_rate INTO user_profile
    FROM public.profiles WHERE id = request_record.user_id;

    UPDATE public.time_off_requests
    SET status = 'approved', approved_by = approver_id, approved_at = NOW(), updated_at = NOW()
    WHERE id = request_id;

    INSERT INTO public.approved_time_off (user_id, request_id, start_date, end_date, days_taken, request_type, hourly_rate)
    VALUES (request_record.user_id, request_id, request_record.start_date, request_record.end_date,
            request_record.days_requested, request_record.request_type, user_profile.hourly_rate);

    RETURN TRUE;
END;
$$;

-- Deny time off request function
CREATE OR REPLACE FUNCTION public.deny_time_off_request(request_id uuid, approver_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SET search_path = ''
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.time_off_requests
    SET status = 'denied', approved_by = approver_id, approved_at = NOW(), updated_at = NOW()
    WHERE id = request_id AND status = 'pending';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Request not found or already processed';
    END IF;

    RETURN TRUE;
END;
$$;

-- Delete time off request function
CREATE OR REPLACE FUNCTION public.delete_time_off_request(request_id uuid)
RETURNS void
LANGUAGE sql
AS $$
    DELETE FROM public.time_off_requests WHERE id = request_id;
$$;

-- Exception time off request function
CREATE OR REPLACE FUNCTION public.exception_time_off_request(request_id uuid, approver_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SET search_path = ''
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.time_off_requests
    SET status = 'exception', approved_by = approver_id, approved_at = NOW(), updated_at = NOW()
    WHERE id = request_id AND status = 'pending';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Request not found or already processed';
    END IF;

    RETURN TRUE;
END;
$$;

-- ============================================================================
-- PART 12: TRIGGERS
-- ============================================================================

-- New user trigger
DROP TRIGGER IF EXISTS insert_new_profile ON auth.users;
CREATE TRIGGER insert_new_profile
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Employee shifts updated_at trigger
DROP TRIGGER IF EXISTS employee_shifts_updated_at ON employee_shifts;
CREATE TRIGGER employee_shifts_updated_at
    BEFORE UPDATE ON employee_shifts
    FOR EACH ROW EXECUTE FUNCTION update_employee_shifts_updated_at();

-- Time entries calculate hours trigger
DROP TRIGGER IF EXISTS calculate_hours_trigger ON time_entries;
CREATE TRIGGER calculate_hours_trigger
    BEFORE UPDATE ON time_entries
    FOR EACH ROW EXECUTE FUNCTION calculate_total_hours();

-- Update timestamps triggers
DROP TRIGGER IF EXISTS update_calls_updated_at ON calls;
CREATE TRIGGER update_calls_updated_at
    BEFORE UPDATE ON public.calls
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_report_cards_updated_at ON report_cards;
CREATE TRIGGER update_report_cards_updated_at
    BEFORE UPDATE ON public.report_cards
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_audit_templates_updated_at ON audit_templates;
CREATE TRIGGER update_audit_templates_updated_at
    BEFORE UPDATE ON public.audit_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- PART 13: ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.approved_time_off ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.early_clock_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pay_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_calculations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_off_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dashboard_embeds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coaching_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_tags_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collection_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.score_disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispute_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispute_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.keyword_libraries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.script_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_sync_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_db_config ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Admins may delete any profile" ON public.profiles FOR DELETE TO authenticated
    USING ((SELECT public.has_role('admin'::public.app_role)));

CREATE POLICY "Admins or the owner may create a profile" ON public.profiles FOR INSERT TO authenticated
    WITH CHECK (((SELECT auth.uid()) = id OR (SELECT public.has_role('admin'::public.app_role))));

CREATE POLICY "Users with role may view a profile" ON public.profiles FOR SELECT TO authenticated
    USING ((SELECT auth.uid()) = id
        OR (SELECT public.has_any_role(ARRAY['admin'::public.app_role, 'manager'::public.app_role, 'ccm'::public.app_role, 'crm'::public.app_role])));

CREATE POLICY "Admins or the owner may update a profile" ON public.profiles FOR UPDATE TO authenticated
    USING (((SELECT auth.uid()) = id OR (SELECT public.has_role('admin'::public.app_role))));

-- Time entries policies
CREATE POLICY "Admins, managers, and the owner may delete time entries" ON public.time_entries FOR DELETE TO authenticated
    USING (((SELECT auth.uid()) = user_id OR (SELECT public.has_any_role(ARRAY['admin'::public.app_role, 'manager'::public.app_role]))));

CREATE POLICY "Admins, managers, and the owner may create new entries" ON public.time_entries FOR INSERT TO authenticated
    WITH CHECK (((SELECT auth.uid()) = user_id OR (SELECT public.has_any_role(ARRAY['admin'::public.app_role, 'manager'::public.app_role]))));

CREATE POLICY "Admins, managers, and the owner may see entries" ON public.time_entries FOR SELECT TO authenticated
    USING (((SELECT auth.uid()) = user_id OR (SELECT public.has_any_role(ARRAY['admin'::public.app_role, 'manager'::public.app_role]))));

CREATE POLICY "Admins, managers, and the owner may update entries" ON public.time_entries FOR UPDATE TO authenticated
    USING (((SELECT auth.uid()) = user_id OR (SELECT public.has_any_role(ARRAY['admin'::public.app_role, 'manager'::public.app_role]))));

-- Time corrections policies
CREATE POLICY "Admins and managers or the owner can view time corrections" ON public.time_corrections FOR SELECT TO authenticated
    USING (((SELECT public.has_any_role(ARRAY['admin'::public.app_role, 'manager'::public.app_role])) OR (SELECT auth.uid()) = user_id));

CREATE POLICY "Admins and managers can update time corrections" ON public.time_corrections FOR UPDATE TO authenticated
    USING ((SELECT public.has_any_role(ARRAY['admin'::public.app_role, 'manager'::public.app_role])));

CREATE POLICY "Users can create their own time corrections" ON public.time_corrections FOR INSERT TO authenticated
    WITH CHECK (((SELECT auth.uid()) = user_id));

-- Time off requests policies
CREATE POLICY "User can view all time off requests" ON public.time_off_requests FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins and user can update time off requests" ON public.time_off_requests FOR UPDATE TO authenticated
    USING (((SELECT public.has_any_role(ARRAY['admin'::public.app_role]))
        OR ((SELECT auth.uid()) = user_id AND status = 'pending')));

CREATE POLICY "Users can create their own time off requests" ON public.time_off_requests FOR INSERT TO authenticated
    WITH CHECK (((SELECT auth.uid()) = user_id));

CREATE POLICY "Users can delete their own time off requests" ON public.time_off_requests FOR DELETE TO authenticated
    USING (((SELECT auth.uid()) = user_id));

-- Approved time off policies
CREATE POLICY "Admins and managers or the owner can view approved time off" ON public.approved_time_off FOR SELECT TO authenticated
    USING (((SELECT auth.uid()) = user_id OR (SELECT public.has_any_role(ARRAY['admin'::public.app_role, 'manager'::public.app_role]))));

CREATE POLICY "Only admins and managers can insert approved time off" ON public.approved_time_off FOR INSERT TO authenticated
    WITH CHECK ((SELECT public.has_any_role(ARRAY['admin'::public.app_role, 'manager'::public.app_role])));

-- Early clock attempts policies
CREATE POLICY "Users can create their own early clock attempts" ON public.early_clock_attempts FOR INSERT TO authenticated
    WITH CHECK (((SELECT auth.uid()) = user_id));

CREATE POLICY "Users can update their own early clock attempts" ON public.early_clock_attempts FOR UPDATE TO authenticated
    USING (((SELECT auth.uid()) = user_id));

CREATE POLICY "Users can view their own early clock attempts" ON public.early_clock_attempts FOR SELECT TO authenticated
    USING (((SELECT auth.uid()) = user_id));

-- Employee shifts policies
CREATE POLICY "Admins can delete employee shifts" ON public.employee_shifts FOR DELETE TO authenticated
    USING (((SELECT public.has_any_role(ARRAY['admin'::public.app_role]))));

CREATE POLICY "Admins can insert employee shifts" ON public.employee_shifts FOR INSERT TO authenticated
    WITH CHECK (((SELECT public.has_any_role(ARRAY['admin'::public.app_role]))));

CREATE POLICY "Admins can update employee shifts" ON public.employee_shifts FOR UPDATE TO authenticated
    USING (((SELECT public.has_any_role(ARRAY['admin'::public.app_role]))));

CREATE POLICY "Users can view all employee shifts" ON public.employee_shifts FOR SELECT TO authenticated USING (true);

-- Holidays policies
CREATE POLICY "Admins can manage holidays" ON public.holidays TO authenticated
    USING ((SELECT public.has_any_role(ARRAY['admin'::public.app_role])));

-- Pay periods policies
CREATE POLICY "Admins can manage pay periods" ON public.pay_periods FOR ALL TO authenticated
    USING ((SELECT public.has_any_role(ARRAY['admin'::public.app_role])));

-- Payroll calculations policies
CREATE POLICY "Admins can manage payroll calculations" ON public.payroll_calculations FOR ALL TO authenticated
    USING ((SELECT public.has_any_role(ARRAY['admin'::public.app_role])));

-- Notifications policies
CREATE POLICY "Users can view own notifications" ON notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own notifications" ON notifications FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Admins can insert notifications" ON notifications FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'manager')) OR auth.uid() = user_id);

-- Calls policies
CREATE POLICY "Users can view their own calls" ON public.calls FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Managers can view all calls" ON public.calls FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'manager')));
CREATE POLICY "System can insert calls" ON public.calls FOR INSERT WITH CHECK (true);
CREATE POLICY "System can update calls" ON public.calls FOR UPDATE USING (true);

-- Report cards policies
CREATE POLICY "Users can view their own report cards" ON public.report_cards FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Managers can view all report cards" ON public.report_cards FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'manager')));
CREATE POLICY "System can insert report cards" ON public.report_cards FOR INSERT WITH CHECK (true);

-- Audit templates policies
CREATE POLICY "Everyone can view active templates" ON public.audit_templates FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can manage templates" ON public.audit_templates FOR ALL
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Audit cache policies
CREATE POLICY "System can manage audit cache" ON public.audit_cache FOR ALL USING (true);

-- Company settings policies
CREATE POLICY "Everyone can read settings" ON company_settings FOR SELECT USING (true);
CREATE POLICY "Admins can update settings" ON company_settings FOR UPDATE
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));
CREATE POLICY "Admins can insert settings" ON company_settings FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

-- Announcements policies
CREATE POLICY "Everyone can read announcements" ON announcements FOR SELECT
    USING (is_active = true AND (starts_at IS NULL OR starts_at <= NOW()) AND (expires_at IS NULL OR expires_at > NOW()));
CREATE POLICY "Managers can manage announcements" ON announcements FOR ALL
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'manager')));

-- Audit log policies
CREATE POLICY "Admins can read audit log" ON audit_log FOR SELECT
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));
CREATE POLICY "Authenticated can insert audit" ON audit_log FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Scheduled shifts policies
CREATE POLICY "Users can view own schedules" ON scheduled_shifts FOR SELECT
    USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'manager')));
CREATE POLICY "Admins can insert schedules" ON scheduled_shifts FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'manager')));
CREATE POLICY "Admins can update schedules" ON scheduled_shifts FOR UPDATE
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'manager')));
CREATE POLICY "Admins can delete schedules" ON scheduled_shifts FOR DELETE
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'manager')));

-- Dashboard embeds policies
CREATE POLICY "Everyone can read active dashboards" ON dashboard_embeds FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can read all dashboards" ON dashboard_embeds FOR SELECT
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));
CREATE POLICY "Admins can insert dashboards" ON dashboard_embeds FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));
CREATE POLICY "Admins can update dashboards" ON dashboard_embeds FOR UPDATE
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));
CREATE POLICY "Admins can delete dashboards" ON dashboard_embeds FOR DELETE
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

-- Coaching sessions policies
CREATE POLICY "Agents see own coaching" ON coaching_sessions FOR SELECT
    USING (agent_id = auth.uid() OR coach_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'manager')));
CREATE POLICY "Coaches manage coaching" ON coaching_sessions FOR ALL
    USING (coach_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'manager')));

-- Agent goals policies
CREATE POLICY "Agents see own goals" ON agent_goals FOR SELECT
    USING (agent_id = auth.uid() OR created_by = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'manager')));
CREATE POLICY "Managers manage goals" ON agent_goals FOR ALL
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'manager')));

-- Performance alerts policies
CREATE POLICY "Users see own alerts" ON performance_alerts FOR SELECT
    USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'manager')));
CREATE POLICY "Insert alerts" ON performance_alerts FOR INSERT WITH CHECK (true);
CREATE POLICY "Update own alerts" ON performance_alerts FOR UPDATE
    USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'manager')));

-- Call tags policies
CREATE POLICY "Everyone can read tags" ON call_tags_master FOR SELECT USING (true);
CREATE POLICY "Managers can manage tags" ON call_tags_master FOR ALL
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'manager')));
CREATE POLICY "Everyone can read call tags" ON call_tags FOR SELECT USING (true);
CREATE POLICY "Authenticated can manage call tags" ON call_tags FOR ALL USING (auth.uid() IS NOT NULL);

-- Call collections policies
CREATE POLICY "Users see collections" ON call_collections FOR SELECT
    USING (is_public = true OR created_by = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'manager')));
CREATE POLICY "Users manage own collections" ON call_collections FOR ALL
    USING (created_by = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'manager')));

-- Collection calls policies
CREATE POLICY "Users access collection calls" ON collection_calls FOR SELECT
    USING (EXISTS (SELECT 1 FROM call_collections WHERE call_collections.id = collection_calls.collection_id
        AND (call_collections.is_public = true OR call_collections.created_by = auth.uid()
            OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'manager')))));
CREATE POLICY "Users manage collection calls" ON collection_calls FOR ALL
    USING (EXISTS (SELECT 1 FROM call_collections WHERE call_collections.id = collection_calls.collection_id
        AND (call_collections.created_by = auth.uid()
            OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'manager')))));

-- Score disputes policies
CREATE POLICY "Users manage own disputes" ON score_disputes FOR ALL
    USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'manager')));

-- Dispute comments policies
CREATE POLICY "Users see appropriate comments" ON dispute_comments FOR SELECT
    USING ((EXISTS (SELECT 1 FROM score_disputes sd WHERE sd.id = dispute_comments.dispute_id AND sd.user_id = auth.uid()) AND NOT is_internal)
        OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'manager')));
CREATE POLICY "Users can add comments to own disputes" ON dispute_comments FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM score_disputes sd WHERE sd.id = dispute_comments.dispute_id
        AND (sd.user_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'manager')))));

-- Dispute history policies
CREATE POLICY "Users see relevant history" ON dispute_history FOR SELECT
    USING (EXISTS (SELECT 1 FROM score_disputes sd WHERE sd.id = dispute_history.dispute_id
        AND (sd.user_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'manager')))));

-- Keyword libraries and script templates policies
CREATE POLICY "Everyone can read keyword libraries" ON keyword_libraries FOR SELECT USING (true);
CREATE POLICY "Admins manage keyword libraries" ON keyword_libraries FOR ALL
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));
CREATE POLICY "Everyone can read scripts" ON script_templates FOR SELECT USING (true);
CREATE POLICY "Admins manage scripts" ON script_templates FOR ALL
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

-- Call analytics policies
CREATE POLICY "Users see own call analytics" ON call_analytics FOR SELECT
    USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'manager')));
CREATE POLICY "System can insert analytics" ON call_analytics FOR INSERT WITH CHECK (true);
CREATE POLICY "System can update analytics" ON call_analytics FOR UPDATE USING (true);

-- Sync tables policies
CREATE POLICY "Admins can view sync logs" ON call_sync_logs FOR SELECT
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'manager')));
CREATE POLICY "Service role full access sync_logs" ON call_sync_logs FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Admins can view sync runs" ON call_sync_runs FOR SELECT
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'manager')));
CREATE POLICY "Service role full access sync_runs" ON call_sync_runs FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Admins can manage db config" ON external_db_config FOR ALL
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));
CREATE POLICY "Service role full access db_config" ON external_db_config FOR ALL USING (auth.role() = 'service_role');

-- ============================================================================
-- PART 14: SEED DATA
-- ============================================================================

-- Default company settings
INSERT INTO company_settings (setting_key, setting_value, description) VALUES
    ('company_name', '"Cliopa.io"', 'Company display name'),
    ('timezone', '"America/Los_Angeles"', 'Default timezone for the organization'),
    ('pay_period_type', '"semi_monthly"', 'Pay period type'),
    ('pay_period_start_day', '8', 'Day of month for semi-monthly'),
    ('overtime_threshold', '40', 'Weekly hours before overtime kicks in'),
    ('overtime_multiplier', '1.5', 'Overtime pay multiplier'),
    ('require_company_network', 'false', 'Require company network/WiFi for clock in'),
    ('allowed_ip_addresses', '[]', 'List of allowed public IP addresses'),
    ('require_scheduled_shift', 'false', 'Require a scheduled shift to clock in'),
    ('break_tracking_enabled', 'false', 'Enable break time tracking'),
    ('auto_clock_out_hours', '12', 'Auto clock out after X hours'),
    ('ai_provider', '"openai"', 'AI provider'),
    ('ai_api_key', '""', 'API key for the AI provider'),
    ('ai_endpoint', '"http://localhost:1234/v1"', 'Custom endpoint URL'),
    ('ai_model', '"gpt-4o-mini"', 'Model name to use for AI analysis')
ON CONFLICT (setting_key) DO NOTHING;

-- Default dashboard embeds
INSERT INTO dashboard_embeds (title, description, url, icon, category, display_order) VALUES
    ('Hours & OT Pay', 'CCM hours, overtime hours, and pay for last pay period', 'http://metabase.tlcops.com/public/question/19b37c9b-ae10-4c55-ad20-e8f067216b45', 'Clock', 'payroll', 1),
    ('PTO/UTO Table', 'Previous pay period PTO and UTO tracking', 'http://metabase.tlcops.com/public/question/80a8a960-ad25-42fe-a05e-286818022c04', 'Clock', 'payroll', 2),
    ('LPD Bonus', 'Last pay period bonus amounts', 'http://metabase.tlcops.com/public/question/8ddfd561-667b-478b-b569-3d30fca9535f', 'DollarSign', 'payroll', 3),
    ('PDP Percentage', 'Previous pay period PDP percentages', 'http://metabase.tlcops.com/public/question/2e055c4c-f65e-4372-a483-ee4373f3d331', 'TrendingUp', 'performance', 1),
    ('Retention Bonus', 'Last pay period retention commission', 'http://metabase.tlcops.com/public/question/68c8ecef-35bf-4afe-85c9-3a3122ef40ba', 'Award', 'payroll', 4),
    ('LPD Goals vs Avg', 'Last pay period goals compared to average', 'http://metabase.tlcops.com/public/question/3cc6d46a-0407-4f3f-a99c-aef1644584c8', 'Target', 'performance', 2)
ON CONFLICT DO NOTHING;

-- Default call tags
INSERT INTO call_tags_master (name, color, description) VALUES
    ('Best Practice', 'green', 'Exemplary calls for training'),
    ('Training Example', 'blue', 'Useful for onboarding new agents'),
    ('Needs Review', 'yellow', 'Requires manager attention'),
    ('Compliance Issue', 'red', 'Contains potential compliance violations'),
    ('High Empathy', 'pink', 'Great example of empathetic communication'),
    ('Successful Close', 'teal', 'Resulted in successful outcome'),
    ('Escalation', 'orange', 'Contains escalation or supervisor request'),
    ('Objection Handling', 'purple', 'Good objection handling example')
ON CONFLICT (name) DO NOTHING;

-- Default keyword libraries
INSERT INTO keyword_libraries (name, description, category, keywords) VALUES
(
    'Compliance - Required Phrases',
    'Phrases agents must say on every call',
    'compliance',
    '[{"phrase": "this call may be recorded", "weight": 10, "exact_match": false}, {"phrase": "for quality assurance", "weight": 5, "exact_match": false}]'
),
(
    'Prohibited Language',
    'Words and phrases agents should never use',
    'prohibited',
    '[{"phrase": "I promise", "weight": -10, "exact_match": false}, {"phrase": "guarantee", "weight": -5, "exact_match": false}]'
),
(
    'Empathy Indicators',
    'Phrases showing empathy and understanding',
    'empathy',
    '[{"phrase": "I understand", "weight": 3, "exact_match": false}, {"phrase": "I appreciate", "weight": 3, "exact_match": false}]'
)
ON CONFLICT DO NOTHING;

-- Default external DB config
INSERT INTO external_db_config (name, db_type, config, sync_interval_minutes)
VALUES (
    'Five9 Call Recordings',
    'mssql',
    '{"server": "sql03.ad.yattaops.com", "database": "Yatta", "schema": "fivenine", "table": "call_recording_logs", "note": "Credentials stored in sync-service .env file"}',
    15
)
ON CONFLICT (name) DO NOTHING;

-- Auto-approver user (will be created when auth.users is available)
-- This is handled by the seed file

-- ============================================================================
-- PART 15: GRANT PERMISSIONS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE ON public.calls TO authenticated;
GRANT SELECT ON public.calls TO anon;
GRANT SELECT, INSERT ON public.report_cards TO authenticated;
GRANT SELECT ON public.report_cards TO anon;
GRANT SELECT ON public.audit_templates TO authenticated;
GRANT ALL ON public.audit_templates TO service_role;
GRANT ALL ON public.audit_cache TO service_role;
GRANT SELECT ON company_settings TO authenticated;
GRANT UPDATE ON company_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON announcements TO authenticated;
GRANT SELECT, INSERT ON audit_log TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON scheduled_shifts TO authenticated;
GRANT SELECT ON dashboard_embeds TO authenticated;
GRANT INSERT, UPDATE, DELETE ON dashboard_embeds TO authenticated;
GRANT SELECT, INSERT, UPDATE ON coaching_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON agent_goals TO authenticated;
GRANT SELECT, INSERT, UPDATE ON performance_alerts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON call_tags_master TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON call_tags TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON call_collections TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON collection_calls TO authenticated;
GRANT SELECT, INSERT, UPDATE ON score_disputes TO authenticated;
GRANT SELECT, INSERT ON dispute_comments TO authenticated;
GRANT SELECT ON dispute_history TO authenticated;
GRANT SELECT ON keyword_libraries TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON keyword_libraries TO authenticated;
GRANT SELECT ON script_templates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON script_templates TO authenticated;
GRANT SELECT, INSERT, UPDATE ON call_analytics TO authenticated;
GRANT SELECT ON call_sync_logs TO authenticated;
GRANT SELECT ON call_sync_runs TO authenticated;
GRANT SELECT ON external_db_config TO authenticated;
GRANT USAGE ON TYPE public.notification_type TO authenticated;
GRANT SELECT, UPDATE, DELETE ON notifications TO authenticated;

-- Function grants
GRANT EXECUTE ON FUNCTION public.approve_time_correction(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_time_correction(uuid, uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION public.approve_time_correction(uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.deny_time_correction(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.deny_time_correction(uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION public.deny_time_correction(uuid, text) TO service_role;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
