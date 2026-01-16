-- Call Sync Tracking
-- Tracks sync operations from external databases

-- Sync logs table
CREATE TABLE IF NOT EXISTS call_sync_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    call_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('success', 'error', 'skipped')),
    error_message TEXT,
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    source TEXT DEFAULT 'sql_server'
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_call_sync_logs_call_id ON call_sync_logs(call_id);
CREATE INDEX IF NOT EXISTS idx_call_sync_logs_synced_at ON call_sync_logs(synced_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_sync_logs_status ON call_sync_logs(status);

-- Sync runs table - tracks each sync operation
CREATE TABLE IF NOT EXISTS call_sync_runs (
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

-- Index for recent runs
CREATE INDEX IF NOT EXISTS idx_call_sync_runs_started_at ON call_sync_runs(started_at DESC);

-- External database configuration
CREATE TABLE IF NOT EXISTS external_db_config (
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

-- Insert default Five9/SQL Server config placeholder
INSERT INTO external_db_config (name, db_type, config, sync_interval_minutes)
VALUES (
    'Five9 Call Recordings',
    'mssql',
    '{
        "server": "sql03.ad.yattaops.com",
        "database": "Yatta",
        "schema": "fivenine",
        "table": "call_recording_logs",
        "note": "Credentials stored in sync-service .env file"
    }',
    15
)
ON CONFLICT (name) DO NOTHING;

-- Function to get sync status
CREATE OR REPLACE FUNCTION get_sync_status()
RETURNS TABLE (
    last_sync_at TIMESTAMPTZ,
    last_sync_status TEXT,
    calls_synced_today BIGINT,
    calls_pending BIGINT,
    total_calls BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        (SELECT MAX(synced_at) FROM call_sync_logs) as last_sync_at,
        (SELECT status FROM call_sync_runs ORDER BY started_at DESC LIMIT 1) as last_sync_status,
        (SELECT COUNT(*) FROM call_sync_logs WHERE synced_at >= CURRENT_DATE AND status = 'success') as calls_synced_today,
        (SELECT COUNT(*) FROM calls WHERE processing_status IN ('pending', 'queued')) as calls_pending,
        (SELECT COUNT(*) FROM calls) as total_calls;
END;
$$;

-- Enable RLS
ALTER TABLE call_sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_sync_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_db_config ENABLE ROW LEVEL SECURITY;

-- RLS policies (admin/manager only)
CREATE POLICY "Admins can view sync logs" ON call_sync_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'manager')
        )
    );

CREATE POLICY "Admins can view sync runs" ON call_sync_runs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'manager')
        )
    );

CREATE POLICY "Admins can manage db config" ON external_db_config
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Service role can do everything
CREATE POLICY "Service role full access sync_logs" ON call_sync_logs
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access sync_runs" ON call_sync_runs
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access db_config" ON external_db_config
    FOR ALL USING (auth.role() = 'service_role');

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_sync_status() TO authenticated;
GRANT SELECT ON call_sync_logs TO authenticated;
GRANT SELECT ON call_sync_runs TO authenticated;
GRANT SELECT ON external_db_config TO authenticated;
