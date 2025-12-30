-- Metabase Dashboard Configuration
-- Allows admins to dynamically manage embedded dashboard links

-- ============================================
-- Dashboard Embeds Table
-- ============================================
CREATE TABLE IF NOT EXISTS dashboard_embeds (
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

-- Index for ordering
CREATE INDEX IF NOT EXISTS idx_dashboard_embeds_order ON dashboard_embeds(category, display_order);
CREATE INDEX IF NOT EXISTS idx_dashboard_embeds_active ON dashboard_embeds(is_active);

-- Enable RLS
ALTER TABLE dashboard_embeds ENABLE ROW LEVEL SECURITY;

-- Everyone can read active dashboards
CREATE POLICY "Everyone can read active dashboards" ON dashboard_embeds
    FOR SELECT USING (is_active = true);

-- Admins can read all dashboards (including inactive)
CREATE POLICY "Admins can read all dashboards" ON dashboard_embeds
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Admins can insert dashboards
CREATE POLICY "Admins can insert dashboards" ON dashboard_embeds
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Admins can update dashboards
CREATE POLICY "Admins can update dashboards" ON dashboard_embeds
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Admins can delete dashboards
CREATE POLICY "Admins can delete dashboards" ON dashboard_embeds
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Insert default dashboards (the existing Metabase links)
INSERT INTO dashboard_embeds (title, description, url, icon, category, display_order) VALUES
    ('Hours & OT Pay', 'CCM hours, overtime hours, and pay for last pay period', 'http://metabase.tlcops.com/public/question/19b37c9b-ae10-4c55-ad20-e8f067216b45', 'Clock', 'payroll', 1),
    ('PTO/UTO Table', 'Previous pay period PTO and UTO tracking', 'http://metabase.tlcops.com/public/question/80a8a960-ad25-42fe-a05e-286818022c04', 'Clock', 'payroll', 2),
    ('LPD Bonus', 'Last pay period bonus amounts in dollars', 'http://metabase.tlcops.com/public/question/8ddfd561-667b-478b-b569-3d30fca9535f', 'DollarSign', 'payroll', 3),
    ('PDP Percentage', 'Previous pay period PDP percentages', 'http://metabase.tlcops.com/public/question/2e055c4c-f65e-4372-a483-ee4373f3d331', 'TrendingUp', 'performance', 1),
    ('Retention Bonus', 'Last pay period retention commission', 'http://metabase.tlcops.com/public/question/68c8ecef-35bf-4afe-85c9-3a3122ef40ba', 'Award', 'payroll', 4),
    ('LPD Goals vs Avg', 'Last pay period goals compared to average', 'http://metabase.tlcops.com/public/question/3cc6d46a-0407-4f3f-a99c-aef1644584c8', 'Target', 'performance', 2)
ON CONFLICT DO NOTHING;

-- Grant permissions
GRANT SELECT ON dashboard_embeds TO authenticated;
GRANT INSERT, UPDATE, DELETE ON dashboard_embeds TO authenticated;
