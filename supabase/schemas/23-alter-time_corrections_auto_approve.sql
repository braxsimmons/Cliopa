-- Add auto-approval support to time_corrections table
-- Auto-approvable corrections are those with <= 10 minute delta for both start AND end times
-- These get auto-approved at end of day to prevent gaming

-- Add new columns
ALTER TABLE public.time_corrections
  ADD COLUMN IF NOT EXISTS auto_approvable BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_approved_at TIMESTAMP WITH TIME ZONE NULL;

-- Create index for finding auto-approvable corrections
CREATE INDEX IF NOT EXISTS idx_time_corrections_auto_approvable
  ON public.time_corrections (auto_approvable, status, created_at)
  WHERE auto_approvable = true AND status = 'pending';

-- Function to auto-approve eligible corrections at end of day
-- This should be called by a pg_cron job at midnight
CREATE OR REPLACE FUNCTION auto_approve_small_corrections()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  approved_count INTEGER;
BEGIN
  -- Auto-approve corrections that are:
  -- 1. Flagged as auto_approvable
  -- 2. Still pending
  -- 3. Created before today (not same-day submissions to prevent gaming)
  UPDATE time_corrections
  SET
    status = 'approved',
    auto_approved_at = NOW(),
    review_notes = 'Auto-approved (within 10 min tolerance)',
    updated_at = NOW()
  WHERE auto_approvable = true
    AND status = 'pending'
    AND created_at::date < CURRENT_DATE;

  GET DIAGNOSTICS approved_count = ROW_COUNT;

  RETURN approved_count;
END;
$$;

-- Grant execute permission to authenticated users (for manual trigger by admins)
GRANT EXECUTE ON FUNCTION auto_approve_small_corrections() TO authenticated;

COMMENT ON COLUMN public.time_corrections.auto_approvable IS 'True if correction delta is <= 10 minutes and eligible for automatic approval';
COMMENT ON COLUMN public.time_corrections.auto_approved_at IS 'Timestamp when the correction was automatically approved';
COMMENT ON FUNCTION auto_approve_small_corrections() IS 'Auto-approves pending corrections with small time deltas. Should be called at end of day via cron job.';
