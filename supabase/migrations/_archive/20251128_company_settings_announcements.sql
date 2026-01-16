-- Company Settings & Announcements System
-- Adds company configuration and team announcements

-- ============================================
-- Company Settings Table
-- ============================================
CREATE TABLE IF NOT EXISTS company_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value JSONB NOT NULL,
    description TEXT,
    updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default settings
INSERT INTO company_settings (setting_key, setting_value, description) VALUES
    ('company_name', '"Cliopa.io"', 'Company display name'),
    ('timezone', '"America/Los_Angeles"', 'Default timezone for the organization'),
    ('pay_period_type', '"semi_monthly"', 'Pay period type: weekly, bi_weekly, semi_monthly, monthly'),
    ('pay_period_start_day', '8', 'Day of month for semi-monthly (or day of week for weekly)'),
    ('overtime_threshold', '40', 'Weekly hours before overtime kicks in'),
    ('overtime_multiplier', '1.5', 'Overtime pay multiplier'),
    ('require_company_network', 'false', 'Require company network/WiFi for clock in'),
    ('allowed_ip_addresses', '[]', 'List of allowed public IP addresses for clock in'),
    ('require_scheduled_shift', 'false', 'Require a scheduled shift to clock in'),
    ('break_tracking_enabled', 'false', 'Enable break time tracking'),
    ('auto_clock_out_hours', '12', 'Auto clock out after X hours (0 to disable)')
ON CONFLICT (setting_key) DO NOTHING;

-- Enable RLS
ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;

-- Everyone can read settings
CREATE POLICY "Everyone can read settings" ON company_settings
    FOR SELECT USING (true);

-- Only admins can update settings
CREATE POLICY "Admins can update settings" ON company_settings
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- ============================================
-- Announcements Table
-- ============================================
CREATE TABLE IF NOT EXISTS announcements (
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

-- Index for active announcements
CREATE INDEX IF NOT EXISTS idx_announcements_active ON announcements(is_active, starts_at, expires_at);

-- Enable RLS
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- Everyone can read active announcements
CREATE POLICY "Everyone can read announcements" ON announcements
    FOR SELECT USING (
        is_active = true
        AND (starts_at IS NULL OR starts_at <= NOW())
        AND (expires_at IS NULL OR expires_at > NOW())
    );

-- Admins/managers can manage announcements
CREATE POLICY "Managers can manage announcements" ON announcements
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'manager')
        )
    );

-- ============================================
-- Audit Log Table
-- ============================================
CREATE TABLE IF NOT EXISTS audit_log (
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

-- Indexes for audit log
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at DESC);

-- Enable RLS
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can read audit log
CREATE POLICY "Admins can read audit log" ON audit_log
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- System can insert audit entries
CREATE POLICY "Authenticated can insert audit" ON audit_log
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================
-- Function to log audit entries
-- ============================================
CREATE OR REPLACE FUNCTION log_audit_event(
    p_action VARCHAR,
    p_entity_type VARCHAR,
    p_entity_id UUID DEFAULT NULL,
    p_old_values JSONB DEFAULT NULL,
    p_new_values JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_audit_id UUID;
BEGIN
    INSERT INTO audit_log (user_id, action, entity_type, entity_id, old_values, new_values)
    VALUES (auth.uid(), p_action, p_entity_type, p_entity_id, p_old_values, p_new_values)
    RETURNING id INTO v_audit_id;

    RETURN v_audit_id;
END;
$$;

-- Grant permissions
GRANT SELECT ON company_settings TO authenticated;
GRANT UPDATE ON company_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON announcements TO authenticated;
GRANT SELECT, INSERT ON audit_log TO authenticated;
GRANT EXECUTE ON FUNCTION log_audit_event TO authenticated;
