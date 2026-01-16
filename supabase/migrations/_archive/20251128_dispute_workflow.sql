-- Score Dispute/Appeal Workflow System
-- Allows agents to dispute AI audit scores with manager review

-- ============================================
-- Score Disputes Table
-- ============================================
CREATE TABLE IF NOT EXISTS score_disputes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

    -- What's being disputed
    report_card_id UUID NOT NULL REFERENCES report_cards(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

    -- Dispute Details
    dispute_reason TEXT NOT NULL,
    criteria_disputed JSONB DEFAULT '[]',
    -- Array of: { "criterion_id": "QQ", "original_result": "FAIL", "agent_claim": "I did ask QQs at 2:35" }

    supporting_evidence TEXT,
    -- Agent can provide timestamps, quotes, or other evidence

    requested_scores JSONB,
    -- { "overall_score": 85, "communication_score": 90 }

    -- Dispute Status
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN (
        'pending',       -- Awaiting review
        'under_review',  -- Manager is reviewing
        'approved',      -- Score adjustment approved
        'partially_approved', -- Some items approved
        'rejected',      -- Appeal denied
        'withdrawn'      -- Agent withdrew dispute
    )),

    priority VARCHAR(10) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),

    -- Resolution
    reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,

    resolution_notes TEXT,
    adjusted_scores JSONB,
    -- { "overall_score": 82, "communication_score": 88, "adjustments": [...] }

    criteria_adjustments JSONB DEFAULT '[]',
    -- Array of: { "criterion_id": "QQ", "original": "FAIL", "adjusted": "PASS", "reason": "..." }

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_disputes_report_card ON score_disputes(report_card_id);
CREATE INDEX IF NOT EXISTS idx_disputes_user ON score_disputes(user_id);
CREATE INDEX IF NOT EXISTS idx_disputes_status ON score_disputes(status);
CREATE INDEX IF NOT EXISTS idx_disputes_reviewer ON score_disputes(reviewed_by);
CREATE INDEX IF NOT EXISTS idx_disputes_created ON score_disputes(created_at DESC);

-- Enable RLS
ALTER TABLE score_disputes ENABLE ROW LEVEL SECURITY;

-- Users can view and create their own disputes
CREATE POLICY "Users manage own disputes" ON score_disputes
    FOR ALL USING (
        user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'manager')
        )
    );

-- ============================================
-- Dispute Comments Table
-- ============================================
CREATE TABLE IF NOT EXISTS dispute_comments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    dispute_id UUID NOT NULL REFERENCES score_disputes(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

    comment TEXT NOT NULL,
    is_internal BOOLEAN DEFAULT false, -- Internal notes only visible to managers

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dispute_comments_dispute ON dispute_comments(dispute_id);

-- Enable RLS
ALTER TABLE dispute_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see appropriate comments" ON dispute_comments
    FOR SELECT USING (
        -- Users can see their own dispute's non-internal comments
        (EXISTS (
            SELECT 1 FROM score_disputes sd
            WHERE sd.id = dispute_comments.dispute_id
            AND sd.user_id = auth.uid()
        ) AND NOT is_internal)
        OR
        -- Managers can see all comments
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'manager')
        )
    );

CREATE POLICY "Users can add comments to own disputes" ON dispute_comments
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM score_disputes sd
            WHERE sd.id = dispute_comments.dispute_id
            AND (sd.user_id = auth.uid() OR EXISTS (
                SELECT 1 FROM profiles
                WHERE profiles.id = auth.uid()
                AND profiles.role IN ('admin', 'manager')
            ))
        )
    );

-- ============================================
-- Dispute History/Audit Log
-- ============================================
CREATE TABLE IF NOT EXISTS dispute_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    dispute_id UUID NOT NULL REFERENCES score_disputes(id) ON DELETE CASCADE,

    action VARCHAR(50) NOT NULL,
    -- 'created', 'status_changed', 'comment_added', 'scores_adjusted', 'reviewer_assigned'

    old_value JSONB,
    new_value JSONB,

    performed_by UUID NOT NULL REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dispute_history_dispute ON dispute_history(dispute_id);
CREATE INDEX IF NOT EXISTS idx_dispute_history_created ON dispute_history(created_at DESC);

-- Enable RLS
ALTER TABLE dispute_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see relevant history" ON dispute_history
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM score_disputes sd
            WHERE sd.id = dispute_history.dispute_id
            AND (sd.user_id = auth.uid() OR EXISTS (
                SELECT 1 FROM profiles
                WHERE profiles.id = auth.uid()
                AND profiles.role IN ('admin', 'manager')
            ))
        )
    );

-- ============================================
-- Function to create dispute notification
-- ============================================
CREATE OR REPLACE FUNCTION notify_dispute_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_agent_name TEXT;
BEGIN
    -- Get agent name
    SELECT CONCAT(first_name, ' ', last_name) INTO v_agent_name
    FROM profiles WHERE id = NEW.user_id;

    -- Create notification for managers
    INSERT INTO notifications (user_id, type, title, message, action_url, metadata)
    SELECT
        p.id,
        'dispute_submitted',
        'New Score Dispute',
        v_agent_name || ' has submitted a score dispute for review.',
        '/disputes/' || NEW.id,
        jsonb_build_object(
            'dispute_id', NEW.id,
            'agent_id', NEW.user_id,
            'agent_name', v_agent_name
        )
    FROM profiles p
    WHERE p.role IN ('admin', 'manager');

    -- Log to dispute history
    INSERT INTO dispute_history (dispute_id, action, new_value, performed_by)
    VALUES (
        NEW.id,
        'created',
        jsonb_build_object('reason', NEW.dispute_reason, 'status', NEW.status),
        NEW.user_id
    );

    RETURN NEW;
END;
$$;

CREATE TRIGGER dispute_created_trigger
    AFTER INSERT ON score_disputes
    FOR EACH ROW
    EXECUTE FUNCTION notify_dispute_created();

-- ============================================
-- Function to handle dispute status changes
-- ============================================
CREATE OR REPLACE FUNCTION handle_dispute_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_manager_name TEXT;
BEGIN
    IF OLD.status != NEW.status THEN
        -- Update timestamps
        NEW.updated_at := NOW();

        IF NEW.status IN ('approved', 'partially_approved', 'rejected') AND NEW.reviewed_at IS NULL THEN
            NEW.reviewed_at := NOW();
        END IF;

        -- Get reviewer name
        SELECT CONCAT(first_name, ' ', last_name) INTO v_manager_name
        FROM profiles WHERE id = NEW.reviewed_by;

        -- Notify agent of status change
        INSERT INTO notifications (user_id, type, title, message, action_url, metadata)
        VALUES (
            NEW.user_id,
            CASE
                WHEN NEW.status = 'approved' THEN 'dispute_approved'
                WHEN NEW.status = 'rejected' THEN 'dispute_rejected'
                ELSE 'dispute_updated'
            END,
            CASE
                WHEN NEW.status = 'approved' THEN 'Dispute Approved'
                WHEN NEW.status = 'partially_approved' THEN 'Dispute Partially Approved'
                WHEN NEW.status = 'rejected' THEN 'Dispute Rejected'
                WHEN NEW.status = 'under_review' THEN 'Dispute Under Review'
                ELSE 'Dispute Updated'
            END,
            CASE
                WHEN NEW.status = 'approved' THEN 'Your score dispute has been approved. Your report card has been updated.'
                WHEN NEW.status = 'partially_approved' THEN 'Some items in your dispute have been approved.'
                WHEN NEW.status = 'rejected' THEN 'Your score dispute was not approved. See resolution notes for details.'
                WHEN NEW.status = 'under_review' THEN v_manager_name || ' is now reviewing your dispute.'
                ELSE 'Your dispute status has been updated.'
            END,
            '/report-cards',
            jsonb_build_object(
                'dispute_id', NEW.id,
                'new_status', NEW.status,
                'reviewer', v_manager_name
            )
        );

        -- Log to history
        INSERT INTO dispute_history (dispute_id, action, old_value, new_value, performed_by)
        VALUES (
            NEW.id,
            'status_changed',
            jsonb_build_object('status', OLD.status),
            jsonb_build_object('status', NEW.status, 'resolution_notes', NEW.resolution_notes),
            COALESCE(NEW.reviewed_by, NEW.user_id)
        );

        -- Update report card if approved
        IF NEW.status IN ('approved', 'partially_approved') AND NEW.adjusted_scores IS NOT NULL THEN
            UPDATE report_cards
            SET
                overall_score = COALESCE((NEW.adjusted_scores->>'overall_score')::NUMERIC, overall_score),
                communication_score = COALESCE((NEW.adjusted_scores->>'communication_score')::NUMERIC, communication_score),
                compliance_score = COALESCE((NEW.adjusted_scores->>'compliance_score')::NUMERIC, compliance_score),
                accuracy_score = COALESCE((NEW.adjusted_scores->>'accuracy_score')::NUMERIC, accuracy_score),
                tone_score = COALESCE((NEW.adjusted_scores->>'tone_score')::NUMERIC, tone_score),
                empathy_score = COALESCE((NEW.adjusted_scores->>'empathy_score')::NUMERIC, empathy_score),
                resolution_score = COALESCE((NEW.adjusted_scores->>'resolution_score')::NUMERIC, resolution_score),
                updated_at = NOW()
            WHERE id = NEW.report_card_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER dispute_status_change_trigger
    BEFORE UPDATE ON score_disputes
    FOR EACH ROW
    EXECUTE FUNCTION handle_dispute_status_change();

-- ============================================
-- View for pending disputes summary
-- ============================================
CREATE OR REPLACE VIEW pending_disputes_summary AS
SELECT
    sd.id,
    sd.created_at,
    sd.status,
    sd.priority,
    sd.dispute_reason,

    -- Agent info
    p.id as agent_id,
    p.first_name || ' ' || p.last_name as agent_name,
    p.team,

    -- Report card info
    rc.overall_score as original_score,
    rc.source_file,
    rc.created_at as audit_date,

    -- Reviewer info
    reviewer.first_name || ' ' || reviewer.last_name as reviewer_name,

    -- Time waiting
    EXTRACT(DAY FROM NOW() - sd.created_at) as days_pending

FROM score_disputes sd
JOIN profiles p ON sd.user_id = p.id
JOIN report_cards rc ON sd.report_card_id = rc.id
LEFT JOIN profiles reviewer ON sd.reviewed_by = reviewer.id
WHERE sd.status IN ('pending', 'under_review')
ORDER BY
    CASE sd.priority
        WHEN 'urgent' THEN 1
        WHEN 'high' THEN 2
        WHEN 'normal' THEN 3
        ELSE 4
    END,
    sd.created_at ASC;

-- ============================================
-- Grant Permissions
-- ============================================
GRANT SELECT, INSERT, UPDATE ON score_disputes TO authenticated;
GRANT SELECT, INSERT ON dispute_comments TO authenticated;
GRANT SELECT ON dispute_history TO authenticated;
GRANT SELECT ON pending_disputes_summary TO authenticated;

-- ============================================
-- Comments
-- ============================================
COMMENT ON TABLE score_disputes IS 'Stores agent disputes/appeals for AI audit scores';
COMMENT ON TABLE dispute_comments IS 'Threaded comments on disputes';
COMMENT ON TABLE dispute_history IS 'Audit log of all dispute changes';
