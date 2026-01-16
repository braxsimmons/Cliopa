-- Shift Scheduling System Migration
-- Allows managers to schedule shifts for employees

-- Create scheduled_shifts table
CREATE TABLE IF NOT EXISTS scheduled_shifts (
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

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_scheduled_shifts_user_id ON scheduled_shifts(user_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_shifts_date ON scheduled_shifts(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_scheduled_shifts_user_date ON scheduled_shifts(user_id, scheduled_date);

-- Enable RLS
ALTER TABLE scheduled_shifts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view their own schedules, admins/managers can view all
DROP POLICY IF EXISTS "Users can view own schedules" ON scheduled_shifts;
CREATE POLICY "Users can view own schedules" ON scheduled_shifts
    FOR SELECT USING (
        auth.uid() = user_id
        OR EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'manager')
        )
    );

-- Only admins/managers can insert schedules
DROP POLICY IF EXISTS "Admins can insert schedules" ON scheduled_shifts;
CREATE POLICY "Admins can insert schedules" ON scheduled_shifts
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'manager')
        )
    );

-- Only admins/managers can update schedules
DROP POLICY IF EXISTS "Admins can update schedules" ON scheduled_shifts;
CREATE POLICY "Admins can update schedules" ON scheduled_shifts
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'manager')
        )
    );

-- Only admins/managers can delete schedules
DROP POLICY IF EXISTS "Admins can delete schedules" ON scheduled_shifts;
CREATE POLICY "Admins can delete schedules" ON scheduled_shifts
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'manager')
        )
    );

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON scheduled_shifts TO authenticated;
