-- Add INSERT policy for admins on company_settings
-- This allows admins to insert new settings (like ai_settings)

CREATE POLICY IF NOT EXISTS "Admins can insert settings" ON company_settings
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );
