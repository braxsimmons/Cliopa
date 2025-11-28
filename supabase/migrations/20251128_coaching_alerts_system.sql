-- Coaching & Alerts System
-- Adds agent coaching, performance alerts, and goals tracking

-- ============================================
-- Coaching Sessions Table
-- ============================================
CREATE TABLE IF NOT EXISTS coaching_sessions (
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

    -- Linked data
    related_call_id UUID REFERENCES calls(id) ON DELETE SET NULL,
    related_report_card_id UUID REFERENCES report_cards(id) ON DELETE SET NULL,

    -- Session content
    agenda JSONB DEFAULT '[]',
    notes TEXT,
    action_items JSONB DEFAULT '[]',

    -- Outcomes
    agent_feedback TEXT,
    coach_feedback TEXT,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for coaching sessions
CREATE INDEX IF NOT EXISTS idx_coaching_agent ON coaching_sessions(agent_id);
CREATE INDEX IF NOT EXISTS idx_coaching_coach ON coaching_sessions(coach_id);
CREATE INDEX IF NOT EXISTS idx_coaching_status ON coaching_sessions(status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_coaching_scheduled ON coaching_sessions(scheduled_at);

-- Enable RLS
ALTER TABLE coaching_sessions ENABLE ROW LEVEL SECURITY;

-- Agents can see their own coaching sessions
CREATE POLICY "Agents see own coaching" ON coaching_sessions
    FOR SELECT USING (
        agent_id = auth.uid()
        OR coach_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'manager')
        )
    );

-- Coaches and admins can manage coaching sessions
CREATE POLICY "Coaches manage coaching" ON coaching_sessions
    FOR ALL USING (
        coach_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'manager')
        )
    );

-- ============================================
-- Agent Goals Table
-- ============================================
CREATE TABLE IF NOT EXISTS agent_goals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    agent_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE SET NULL,

    title VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL CHECK (category IN ('quality', 'efficiency', 'compliance', 'communication', 'development', 'custom')),

    -- Goal metrics
    metric_type VARCHAR(50) NOT NULL CHECK (metric_type IN ('score', 'count', 'percentage', 'time', 'custom')),
    target_value DECIMAL(10, 2) NOT NULL,
    current_value DECIMAL(10, 2) DEFAULT 0,
    baseline_value DECIMAL(10, 2),

    -- Timeline
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    target_date DATE NOT NULL,
    completed_date DATE,

    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'missed', 'cancelled')),
    priority VARCHAR(10) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),

    -- Progress tracking
    milestones JSONB DEFAULT '[]',
    progress_history JSONB DEFAULT '[]',

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for goals
CREATE INDEX IF NOT EXISTS idx_goals_agent ON agent_goals(agent_id);
CREATE INDEX IF NOT EXISTS idx_goals_status ON agent_goals(status, target_date);
CREATE INDEX IF NOT EXISTS idx_goals_category ON agent_goals(category);

-- Enable RLS
ALTER TABLE agent_goals ENABLE ROW LEVEL SECURITY;

-- Agents can see their own goals
CREATE POLICY "Agents see own goals" ON agent_goals
    FOR SELECT USING (
        agent_id = auth.uid()
        OR created_by = auth.uid()
        OR EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'manager')
        )
    );

-- Managers can manage goals
CREATE POLICY "Managers manage goals" ON agent_goals
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'manager')
        )
    );

-- ============================================
-- Performance Alerts Table
-- ============================================
CREATE TABLE IF NOT EXISTS performance_alerts (
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

    -- Related data
    related_entity_type VARCHAR(50),
    related_entity_id UUID,
    metadata JSONB DEFAULT '{}',

    -- Status
    is_read BOOLEAN DEFAULT false,
    is_acknowledged BOOLEAN DEFAULT false,
    acknowledged_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    acknowledged_at TIMESTAMPTZ,

    -- Actions
    action_url VARCHAR(500),
    action_label VARCHAR(100),

    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ
);

-- Indexes for alerts
CREATE INDEX IF NOT EXISTS idx_alerts_user ON performance_alerts(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_alerts_type ON performance_alerts(alert_type, severity);
CREATE INDEX IF NOT EXISTS idx_alerts_created ON performance_alerts(created_at DESC);

-- Enable RLS
ALTER TABLE performance_alerts ENABLE ROW LEVEL SECURITY;

-- Users see their own alerts, managers see team alerts
CREATE POLICY "Users see own alerts" ON performance_alerts
    FOR SELECT USING (
        user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'manager')
        )
    );

-- System can insert alerts, users can update their own
CREATE POLICY "Insert alerts" ON performance_alerts
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Update own alerts" ON performance_alerts
    FOR UPDATE USING (
        user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'manager')
        )
    );

-- ============================================
-- Agent Scorecards View (Aggregated Performance)
-- ============================================
CREATE OR REPLACE VIEW agent_scorecards AS
SELECT
    p.id as agent_id,
    p.first_name,
    p.last_name,
    p.email,
    p.team,
    p.role,

    -- Report Card Stats (Last 30 days)
    COUNT(rc.id) FILTER (WHERE rc.created_at >= NOW() - INTERVAL '30 days') as audits_30d,
    ROUND(AVG(rc.overall_score) FILTER (WHERE rc.created_at >= NOW() - INTERVAL '30 days')::numeric, 1) as avg_score_30d,
    ROUND(AVG(rc.compliance_score) FILTER (WHERE rc.created_at >= NOW() - INTERVAL '30 days')::numeric, 1) as compliance_30d,
    ROUND(AVG(rc.communication_score) FILTER (WHERE rc.created_at >= NOW() - INTERVAL '30 days')::numeric, 1) as communication_30d,
    ROUND(AVG(rc.empathy_score) FILTER (WHERE rc.created_at >= NOW() - INTERVAL '30 days')::numeric, 1) as empathy_30d,

    -- Week over Week Change
    ROUND((
        AVG(rc.overall_score) FILTER (WHERE rc.created_at >= NOW() - INTERVAL '7 days') -
        AVG(rc.overall_score) FILTER (WHERE rc.created_at >= NOW() - INTERVAL '14 days' AND rc.created_at < NOW() - INTERVAL '7 days')
    )::numeric, 1) as score_change_wow,

    -- Goal Progress
    COUNT(ag.id) FILTER (WHERE ag.status = 'active') as active_goals,
    COUNT(ag.id) FILTER (WHERE ag.status = 'completed' AND ag.completed_date >= NOW() - INTERVAL '30 days') as goals_completed_30d,

    -- Coaching
    COUNT(cs.id) FILTER (WHERE cs.status = 'completed' AND cs.completed_at >= NOW() - INTERVAL '30 days') as coaching_sessions_30d,
    MAX(cs.scheduled_at) FILTER (WHERE cs.status = 'scheduled' AND cs.scheduled_at > NOW()) as next_coaching_session,

    -- Time Tracking (Last 30 days)
    ROUND(SUM(te.total_hours) FILTER (WHERE te.start_time >= NOW() - INTERVAL '30 days')::numeric, 1) as hours_worked_30d

FROM profiles p
LEFT JOIN report_cards rc ON rc.user_id = p.id
LEFT JOIN agent_goals ag ON ag.agent_id = p.id
LEFT JOIN coaching_sessions cs ON cs.agent_id = p.id
LEFT JOIN time_entries te ON te.user_id = p.id
WHERE p.role NOT IN ('admin')
GROUP BY p.id, p.first_name, p.last_name, p.email, p.team, p.role;

-- ============================================
-- Function to create performance alert
-- ============================================
CREATE OR REPLACE FUNCTION create_performance_alert(
    p_user_id UUID,
    p_alert_type VARCHAR,
    p_severity VARCHAR,
    p_title VARCHAR,
    p_message TEXT,
    p_related_entity_type VARCHAR DEFAULT NULL,
    p_related_entity_id UUID DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}',
    p_action_url VARCHAR DEFAULT NULL,
    p_action_label VARCHAR DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_alert_id UUID;
BEGIN
    INSERT INTO performance_alerts (
        user_id, alert_type, severity, title, message,
        related_entity_type, related_entity_id, metadata,
        action_url, action_label
    )
    VALUES (
        p_user_id, p_alert_type, p_severity, p_title, p_message,
        p_related_entity_type, p_related_entity_id, p_metadata,
        p_action_url, p_action_label
    )
    RETURNING id INTO v_alert_id;

    -- Also create a notification for the user
    INSERT INTO notifications (user_id, type, title, message, action_url, metadata)
    VALUES (
        p_user_id,
        'performance_alert',
        p_title,
        p_message,
        p_action_url,
        jsonb_build_object('alert_id', v_alert_id, 'severity', p_severity, 'alert_type', p_alert_type)
    );

    RETURN v_alert_id;
END;
$$;

-- ============================================
-- Trigger for automatic alert generation on low scores
-- ============================================
CREATE OR REPLACE FUNCTION check_report_card_alerts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_avg_score DECIMAL;
    v_prev_avg_score DECIMAL;
BEGIN
    -- Check for low score alert (below 70)
    IF NEW.overall_score < 70 THEN
        PERFORM create_performance_alert(
            NEW.user_id,
            'low_score',
            CASE WHEN NEW.overall_score < 50 THEN 'critical' ELSE 'warning' END,
            'Low Quality Score Alert',
            'Your recent audit received a score of ' || NEW.overall_score || '%. Review the feedback to improve.',
            'report_card',
            NEW.id,
            jsonb_build_object('score', NEW.overall_score),
            '/report-cards',
            'View Report Card'
        );
    END IF;

    -- Check for excellent performance (above 95)
    IF NEW.overall_score >= 95 THEN
        PERFORM create_performance_alert(
            NEW.user_id,
            'excellent_performance',
            'success',
            'Excellent Performance!',
            'Congratulations! Your recent audit scored ' || NEW.overall_score || '%.',
            'report_card',
            NEW.id,
            jsonb_build_object('score', NEW.overall_score),
            '/report-cards',
            'View Report Card'
        );
    END IF;

    -- Check for significant score drop (compare to 7-day average)
    SELECT AVG(overall_score) INTO v_avg_score
    FROM report_cards
    WHERE user_id = NEW.user_id
    AND created_at >= NOW() - INTERVAL '7 days'
    AND id != NEW.id;

    IF v_avg_score IS NOT NULL AND NEW.overall_score < (v_avg_score - 15) THEN
        PERFORM create_performance_alert(
            NEW.user_id,
            'score_drop',
            'warning',
            'Performance Drop Detected',
            'Your score dropped significantly from your 7-day average of ' || ROUND(v_avg_score, 1) || '%.',
            'report_card',
            NEW.id,
            jsonb_build_object('current_score', NEW.overall_score, 'average_score', v_avg_score),
            '/report-cards',
            'Review Performance'
        );
    END IF;

    RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS report_card_alert_trigger ON report_cards;
CREATE TRIGGER report_card_alert_trigger
    AFTER INSERT ON report_cards
    FOR EACH ROW
    EXECUTE FUNCTION check_report_card_alerts();

-- ============================================
-- Grant permissions
-- ============================================
GRANT SELECT, INSERT, UPDATE ON coaching_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON agent_goals TO authenticated;
GRANT SELECT, INSERT, UPDATE ON performance_alerts TO authenticated;
GRANT SELECT ON agent_scorecards TO authenticated;
GRANT EXECUTE ON FUNCTION create_performance_alert TO authenticated;
