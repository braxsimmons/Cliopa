-- Call Library System
-- Adds tagging, collections, and bookmarking for calls

-- ============================================
-- Add bookmark and notes to calls table
-- ============================================
ALTER TABLE calls
ADD COLUMN IF NOT EXISTS is_bookmarked BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Create index for bookmarked calls
CREATE INDEX IF NOT EXISTS idx_calls_bookmarked ON calls(is_bookmarked) WHERE is_bookmarked = true;

-- ============================================
-- Call Tags Master Table
-- ============================================
CREATE TABLE IF NOT EXISTS call_tags_master (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    color VARCHAR(20) DEFAULT 'blue',
    description TEXT,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE call_tags_master ENABLE ROW LEVEL SECURITY;

-- Everyone can read tags
CREATE POLICY "Everyone can read tags" ON call_tags_master
    FOR SELECT USING (true);

-- Managers can manage tags
CREATE POLICY "Managers can manage tags" ON call_tags_master
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'manager')
        )
    );

-- ============================================
-- Call Tags Junction Table
-- ============================================
CREATE TABLE IF NOT EXISTS call_tags (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    call_id UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES call_tags_master(id) ON DELETE CASCADE,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(call_id, tag_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_call_tags_call ON call_tags(call_id);
CREATE INDEX IF NOT EXISTS idx_call_tags_tag ON call_tags(tag_id);

-- Enable RLS
ALTER TABLE call_tags ENABLE ROW LEVEL SECURITY;

-- Everyone can read call tags
CREATE POLICY "Everyone can read call tags" ON call_tags
    FOR SELECT USING (true);

-- Authenticated users can manage call tags
CREATE POLICY "Authenticated can manage call tags" ON call_tags
    FOR ALL USING (auth.uid() IS NOT NULL);

-- ============================================
-- Call Collections Table
-- ============================================
CREATE TABLE IF NOT EXISTS call_collections (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_public BOOLEAN DEFAULT false,
    created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_collections_creator ON call_collections(created_by);

-- Enable RLS
ALTER TABLE call_collections ENABLE ROW LEVEL SECURITY;

-- Users can see public collections and their own
CREATE POLICY "Users see collections" ON call_collections
    FOR SELECT USING (
        is_public = true
        OR created_by = auth.uid()
        OR EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'manager')
        )
    );

-- Users can manage their own collections
CREATE POLICY "Users manage own collections" ON call_collections
    FOR ALL USING (
        created_by = auth.uid()
        OR EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'manager')
        )
    );

-- ============================================
-- Collection Calls Junction Table
-- ============================================
CREATE TABLE IF NOT EXISTS collection_calls (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    collection_id UUID NOT NULL REFERENCES call_collections(id) ON DELETE CASCADE,
    call_id UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
    added_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(collection_id, call_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_collection_calls_collection ON collection_calls(collection_id);
CREATE INDEX IF NOT EXISTS idx_collection_calls_call ON collection_calls(call_id);

-- Enable RLS
ALTER TABLE collection_calls ENABLE ROW LEVEL SECURITY;

-- Same policy as collections
CREATE POLICY "Users access collection calls" ON collection_calls
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM call_collections
            WHERE call_collections.id = collection_calls.collection_id
            AND (
                call_collections.is_public = true
                OR call_collections.created_by = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM profiles
                    WHERE profiles.id = auth.uid()
                    AND profiles.role IN ('admin', 'manager')
                )
            )
        )
    );

CREATE POLICY "Users manage collection calls" ON collection_calls
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM call_collections
            WHERE call_collections.id = collection_calls.collection_id
            AND (
                call_collections.created_by = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM profiles
                    WHERE profiles.id = auth.uid()
                    AND profiles.role IN ('admin', 'manager')
                )
            )
        )
    );

-- ============================================
-- Default Tags
-- ============================================
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

-- ============================================
-- Function to get collection call count
-- ============================================
CREATE OR REPLACE FUNCTION get_collection_call_count(collection_uuid UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
AS $$
    SELECT COUNT(*)::INTEGER
    FROM collection_calls
    WHERE collection_id = collection_uuid;
$$;

-- ============================================
-- Grant permissions
-- ============================================
GRANT SELECT, INSERT, UPDATE, DELETE ON call_tags_master TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON call_tags TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON call_collections TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON collection_calls TO authenticated;
GRANT EXECUTE ON FUNCTION get_collection_call_count TO authenticated;
