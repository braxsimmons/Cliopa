-- Conversation Intelligence System
-- Adds sentiment analysis, keyword detection, script adherence, and call analytics

-- ============================================
-- Keyword Libraries Table
-- ============================================
CREATE TABLE IF NOT EXISTS keyword_libraries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL CHECK (category IN (
        'compliance', 'prohibited', 'sales', 'empathy',
        'escalation', 'closing', 'greeting', 'custom'
    )),
    keywords JSONB NOT NULL DEFAULT '[]',
    -- Each keyword: { "phrase": "string", "weight": number, "exact_match": boolean }
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default keyword libraries
INSERT INTO keyword_libraries (name, description, category, keywords) VALUES
(
    'Compliance - Required Phrases',
    'Phrases agents must say on every call',
    'compliance',
    '[
        {"phrase": "this call may be recorded", "weight": 10, "exact_match": false},
        {"phrase": "for quality assurance", "weight": 5, "exact_match": false},
        {"phrase": "mini miranda", "weight": 10, "exact_match": false},
        {"phrase": "this is an attempt to collect a debt", "weight": 10, "exact_match": false},
        {"phrase": "any information obtained will be used for that purpose", "weight": 10, "exact_match": false}
    ]'
),
(
    'Prohibited Language',
    'Words and phrases agents should never use',
    'prohibited',
    '[
        {"phrase": "I promise", "weight": -10, "exact_match": false},
        {"phrase": "guarantee", "weight": -5, "exact_match": false},
        {"phrase": "you have to", "weight": -3, "exact_match": false},
        {"phrase": "you must", "weight": -3, "exact_match": false},
        {"phrase": "lawsuit", "weight": -10, "exact_match": false},
        {"phrase": "sue you", "weight": -10, "exact_match": false},
        {"phrase": "garnish", "weight": -8, "exact_match": false},
        {"phrase": "arrest", "weight": -10, "exact_match": false}
    ]'
),
(
    'Empathy Indicators',
    'Phrases showing empathy and understanding',
    'empathy',
    '[
        {"phrase": "I understand", "weight": 3, "exact_match": false},
        {"phrase": "I appreciate", "weight": 3, "exact_match": false},
        {"phrase": "thank you for", "weight": 2, "exact_match": false},
        {"phrase": "I hear you", "weight": 3, "exact_match": false},
        {"phrase": "that must be", "weight": 2, "exact_match": false},
        {"phrase": "I can help", "weight": 3, "exact_match": false}
    ]'
),
(
    'Escalation Triggers',
    'Phrases indicating potential escalation',
    'escalation',
    '[
        {"phrase": "supervisor", "weight": 5, "exact_match": false},
        {"phrase": "manager", "weight": 5, "exact_match": false},
        {"phrase": "complaint", "weight": 4, "exact_match": false},
        {"phrase": "attorney", "weight": 6, "exact_match": false},
        {"phrase": "lawyer", "weight": 6, "exact_match": false},
        {"phrase": "sue", "weight": 7, "exact_match": false},
        {"phrase": "report you", "weight": 5, "exact_match": false}
    ]'
),
(
    'Sales & Closing',
    'Effective sales and closing language',
    'sales',
    '[
        {"phrase": "payment arrangement", "weight": 5, "exact_match": false},
        {"phrase": "settle this", "weight": 4, "exact_match": false},
        {"phrase": "resolve this", "weight": 4, "exact_match": false},
        {"phrase": "today", "weight": 2, "exact_match": false},
        {"phrase": "right now", "weight": 2, "exact_match": false},
        {"phrase": "can we set up", "weight": 3, "exact_match": false}
    ]'
)
ON CONFLICT DO NOTHING;

-- Enable RLS
ALTER TABLE keyword_libraries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can read keyword libraries" ON keyword_libraries
    FOR SELECT USING (true);

CREATE POLICY "Admins manage keyword libraries" ON keyword_libraries
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- ============================================
-- Script Templates Table
-- ============================================
CREATE TABLE IF NOT EXISTS script_templates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL CHECK (category IN (
        'opening', 'verification', 'negotiation',
        'objection_handling', 'closing', 'compliance', 'full_call'
    )),
    script_content TEXT NOT NULL,
    required_phrases JSONB DEFAULT '[]',
    -- Each phrase: { "phrase": "string", "required": boolean, "order": number }
    min_adherence_score INTEGER DEFAULT 70,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE script_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can read scripts" ON script_templates
    FOR SELECT USING (true);

CREATE POLICY "Admins manage scripts" ON script_templates
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- ============================================
-- Call Analytics Table (Extended call data)
-- ============================================
CREATE TABLE IF NOT EXISTS call_analytics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    call_id UUID REFERENCES calls(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

    -- Timing Analysis
    call_duration_seconds INTEGER,
    agent_talk_time_seconds INTEGER,
    customer_talk_time_seconds INTEGER,
    silence_time_seconds INTEGER,
    talk_to_listen_ratio DECIMAL(4, 2),

    -- Sentiment Analysis
    overall_sentiment VARCHAR(20) CHECK (overall_sentiment IN ('positive', 'neutral', 'negative', 'mixed')),
    sentiment_score DECIMAL(4, 2), -- -1 to 1 scale
    sentiment_timeline JSONB DEFAULT '[]',
    -- Array of { "timestamp": number, "sentiment": string, "score": number, "text": string }

    -- Keyword Detection Results
    keywords_found JSONB DEFAULT '[]',
    -- Array of { "phrase": string, "category": string, "count": number, "timestamps": number[], "weight": number }
    compliance_keywords_found INTEGER DEFAULT 0,
    prohibited_keywords_found INTEGER DEFAULT 0,
    empathy_keywords_found INTEGER DEFAULT 0,
    escalation_triggers_found INTEGER DEFAULT 0,

    -- Script Adherence
    script_template_id UUID REFERENCES script_templates(id) ON DELETE SET NULL,
    script_adherence_score DECIMAL(5, 2),
    script_phrases_matched JSONB DEFAULT '[]',
    script_phrases_missed JSONB DEFAULT '[]',

    -- Call Classification
    call_outcome VARCHAR(50) CHECK (call_outcome IN (
        'payment_collected', 'payment_arrangement', 'callback_scheduled',
        'dispute', 'wrong_party', 'refused_to_pay', 'disconnected',
        'voicemail', 'no_contact', 'other'
    )),
    call_topics JSONB DEFAULT '[]',
    customer_intent VARCHAR(50),

    -- Quality Indicators
    dead_air_count INTEGER DEFAULT 0,
    interruption_count INTEGER DEFAULT 0,
    hold_time_seconds INTEGER DEFAULT 0,
    transfer_count INTEGER DEFAULT 0,

    -- AI Analysis
    ai_summary TEXT,
    ai_recommendations JSONB DEFAULT '[]',
    ai_model VARCHAR(50),
    processing_time_ms INTEGER,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for call analytics
CREATE INDEX IF NOT EXISTS idx_call_analytics_call ON call_analytics(call_id);
CREATE INDEX IF NOT EXISTS idx_call_analytics_user ON call_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_call_analytics_sentiment ON call_analytics(overall_sentiment);
CREATE INDEX IF NOT EXISTS idx_call_analytics_created ON call_analytics(created_at DESC);

-- Enable RLS
ALTER TABLE call_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own call analytics" ON call_analytics
    FOR SELECT USING (
        user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'manager')
        )
    );

CREATE POLICY "System can insert analytics" ON call_analytics
    FOR INSERT WITH CHECK (true);

CREATE POLICY "System can update analytics" ON call_analytics
    FOR UPDATE USING (true);

-- ============================================
-- Conversation Insights View (Aggregated)
-- ============================================
CREATE OR REPLACE VIEW conversation_insights AS
SELECT
    p.id as agent_id,
    p.first_name,
    p.last_name,
    p.email,
    p.team,

    -- Call Volume (Last 30 days)
    COUNT(ca.id) FILTER (WHERE ca.created_at >= NOW() - INTERVAL '30 days') as total_calls_30d,

    -- Average Metrics
    ROUND(AVG(ca.call_duration_seconds) FILTER (WHERE ca.created_at >= NOW() - INTERVAL '30 days')::numeric / 60, 1) as avg_call_duration_mins,
    ROUND(AVG(ca.talk_to_listen_ratio) FILTER (WHERE ca.created_at >= NOW() - INTERVAL '30 days')::numeric, 2) as avg_talk_listen_ratio,
    ROUND(AVG(ca.sentiment_score) FILTER (WHERE ca.created_at >= NOW() - INTERVAL '30 days')::numeric, 2) as avg_sentiment_score,
    ROUND(AVG(ca.script_adherence_score) FILTER (WHERE ca.created_at >= NOW() - INTERVAL '30 days')::numeric, 1) as avg_script_adherence,

    -- Sentiment Distribution
    COUNT(ca.id) FILTER (WHERE ca.overall_sentiment = 'positive' AND ca.created_at >= NOW() - INTERVAL '30 days') as positive_calls,
    COUNT(ca.id) FILTER (WHERE ca.overall_sentiment = 'neutral' AND ca.created_at >= NOW() - INTERVAL '30 days') as neutral_calls,
    COUNT(ca.id) FILTER (WHERE ca.overall_sentiment = 'negative' AND ca.created_at >= NOW() - INTERVAL '30 days') as negative_calls,

    -- Keyword Stats
    SUM(ca.compliance_keywords_found) FILTER (WHERE ca.created_at >= NOW() - INTERVAL '30 days') as total_compliance_keywords,
    SUM(ca.prohibited_keywords_found) FILTER (WHERE ca.created_at >= NOW() - INTERVAL '30 days') as total_prohibited_keywords,
    SUM(ca.empathy_keywords_found) FILTER (WHERE ca.created_at >= NOW() - INTERVAL '30 days') as total_empathy_keywords,
    SUM(ca.escalation_triggers_found) FILTER (WHERE ca.created_at >= NOW() - INTERVAL '30 days') as total_escalation_triggers,

    -- Call Outcomes
    COUNT(ca.id) FILTER (WHERE ca.call_outcome = 'payment_collected' AND ca.created_at >= NOW() - INTERVAL '30 days') as payments_collected,
    COUNT(ca.id) FILTER (WHERE ca.call_outcome = 'payment_arrangement' AND ca.created_at >= NOW() - INTERVAL '30 days') as arrangements_made,

    -- Quality Metrics
    ROUND(AVG(ca.dead_air_count) FILTER (WHERE ca.created_at >= NOW() - INTERVAL '30 days')::numeric, 1) as avg_dead_air,
    ROUND(AVG(ca.interruption_count) FILTER (WHERE ca.created_at >= NOW() - INTERVAL '30 days')::numeric, 1) as avg_interruptions

FROM profiles p
LEFT JOIN call_analytics ca ON ca.user_id = p.id
WHERE p.role NOT IN ('admin')
GROUP BY p.id, p.first_name, p.last_name, p.email, p.team;

-- ============================================
-- Team Insights View
-- ============================================
CREATE OR REPLACE VIEW team_conversation_insights AS
SELECT
    p.team,
    COUNT(DISTINCT p.id) as agent_count,
    COUNT(ca.id) FILTER (WHERE ca.created_at >= NOW() - INTERVAL '30 days') as total_calls_30d,
    ROUND(AVG(ca.sentiment_score) FILTER (WHERE ca.created_at >= NOW() - INTERVAL '30 days')::numeric, 2) as avg_sentiment,
    ROUND(AVG(ca.script_adherence_score) FILTER (WHERE ca.created_at >= NOW() - INTERVAL '30 days')::numeric, 1) as avg_script_adherence,
    ROUND(AVG(ca.talk_to_listen_ratio) FILTER (WHERE ca.created_at >= NOW() - INTERVAL '30 days')::numeric, 2) as avg_talk_listen_ratio,
    SUM(ca.prohibited_keywords_found) FILTER (WHERE ca.created_at >= NOW() - INTERVAL '30 days') as total_violations,
    COUNT(ca.id) FILTER (WHERE ca.call_outcome IN ('payment_collected', 'payment_arrangement') AND ca.created_at >= NOW() - INTERVAL '30 days') as successful_outcomes
FROM profiles p
LEFT JOIN call_analytics ca ON ca.user_id = p.id
WHERE p.team IS NOT NULL
GROUP BY p.team;

-- ============================================
-- Function to analyze transcript for keywords
-- ============================================
CREATE OR REPLACE FUNCTION analyze_transcript_keywords(p_transcript TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result JSONB := '[]'::JSONB;
    v_library RECORD;
    v_keyword RECORD;
    v_count INTEGER;
    v_lower_transcript TEXT;
BEGIN
    v_lower_transcript := LOWER(p_transcript);

    FOR v_library IN
        SELECT id, name, category, keywords
        FROM keyword_libraries
        WHERE is_active = true
    LOOP
        FOR v_keyword IN
            SELECT * FROM jsonb_array_elements(v_library.keywords)
        LOOP
            -- Count occurrences
            SELECT (LENGTH(v_lower_transcript) - LENGTH(REPLACE(v_lower_transcript, LOWER(v_keyword.value->>'phrase'), '')))
                   / LENGTH(v_keyword.value->>'phrase')
            INTO v_count;

            IF v_count > 0 THEN
                v_result := v_result || jsonb_build_object(
                    'phrase', v_keyword.value->>'phrase',
                    'category', v_library.category,
                    'library', v_library.name,
                    'count', v_count,
                    'weight', (v_keyword.value->>'weight')::integer
                );
            END IF;
        END LOOP;
    END LOOP;

    RETURN v_result;
END;
$$;

-- ============================================
-- Trigger to create alert on prohibited keywords
-- ============================================
CREATE OR REPLACE FUNCTION check_call_analytics_alerts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Alert on prohibited keywords
    IF NEW.prohibited_keywords_found > 0 THEN
        PERFORM create_performance_alert(
            NEW.user_id,
            'compliance_violation',
            CASE WHEN NEW.prohibited_keywords_found > 3 THEN 'critical' ELSE 'warning' END,
            'Prohibited Language Detected',
            'A call was flagged with ' || NEW.prohibited_keywords_found || ' prohibited keyword(s). Review required.',
            'call_analytics',
            NEW.id,
            jsonb_build_object(
                'prohibited_count', NEW.prohibited_keywords_found,
                'keywords', NEW.keywords_found
            ),
            '/performance',
            'Review Call'
        );
    END IF;

    -- Alert on low script adherence
    IF NEW.script_adherence_score IS NOT NULL AND NEW.script_adherence_score < 60 THEN
        PERFORM create_performance_alert(
            NEW.user_id,
            'compliance_violation',
            'warning',
            'Low Script Adherence',
            'A call scored ' || ROUND(NEW.script_adherence_score, 1) || '% on script adherence. Coaching recommended.',
            'call_analytics',
            NEW.id,
            jsonb_build_object('adherence_score', NEW.script_adherence_score),
            '/coaching',
            'Schedule Coaching'
        );
    END IF;

    -- Alert on negative sentiment calls
    IF NEW.overall_sentiment = 'negative' AND NEW.sentiment_score < -0.5 THEN
        PERFORM create_performance_alert(
            NEW.user_id,
            'review_needed',
            'info',
            'Negative Call Sentiment',
            'A call had significantly negative sentiment. Consider reviewing for coaching opportunities.',
            'call_analytics',
            NEW.id,
            jsonb_build_object('sentiment_score', NEW.sentiment_score),
            '/performance',
            'Review Call'
        );
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS call_analytics_alert_trigger ON call_analytics;
CREATE TRIGGER call_analytics_alert_trigger
    AFTER INSERT ON call_analytics
    FOR EACH ROW
    EXECUTE FUNCTION check_call_analytics_alerts();

-- ============================================
-- Grant permissions
-- ============================================
GRANT SELECT ON keyword_libraries TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON keyword_libraries TO authenticated;
GRANT SELECT ON script_templates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON script_templates TO authenticated;
GRANT SELECT, INSERT, UPDATE ON call_analytics TO authenticated;
GRANT SELECT ON conversation_insights TO authenticated;
GRANT SELECT ON team_conversation_insights TO authenticated;
GRANT EXECUTE ON FUNCTION analyze_transcript_keywords TO authenticated;
