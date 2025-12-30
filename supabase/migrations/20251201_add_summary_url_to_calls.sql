-- Add summary_url column to calls table
ALTER TABLE calls ADD COLUMN IF NOT EXISTS summary_url TEXT;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS summary_text TEXT;

-- Add index for calls with summaries
CREATE INDEX IF NOT EXISTS idx_calls_has_summary ON calls(id) WHERE summary_text IS NOT NULL;
