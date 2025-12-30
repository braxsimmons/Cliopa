-- Automatic Call Processing Pipeline
-- Processes calls that come into the database automatically

-- Add a processing queue status to calls if not exists
DO $$ BEGIN
    ALTER TABLE calls ADD COLUMN IF NOT EXISTS processing_status TEXT DEFAULT 'pending'
        CHECK (processing_status IN ('pending', 'queued', 'processing', 'completed', 'failed'));
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Add index for efficient queue queries
CREATE INDEX IF NOT EXISTS idx_calls_processing_status ON calls(processing_status) WHERE processing_status IN ('pending', 'queued');
CREATE INDEX IF NOT EXISTS idx_calls_pending_audit ON calls(status, created_at) WHERE status = 'pending' OR status = 'transcribed';

-- Function to queue pending calls for processing
CREATE OR REPLACE FUNCTION queue_pending_calls()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    queued_count INTEGER;
BEGIN
    -- Mark pending calls as queued for processing
    UPDATE calls
    SET processing_status = 'queued'
    WHERE processing_status = 'pending'
      AND transcript_text IS NOT NULL
      AND transcript_text != '';

    GET DIAGNOSTICS queued_count = ROW_COUNT;

    RETURN queued_count;
END;
$$;

-- Function to get the next batch of calls to process
CREATE OR REPLACE FUNCTION get_calls_to_process(batch_size INTEGER DEFAULT 10)
RETURNS TABLE (
    call_id UUID,
    user_id UUID,
    transcript_text TEXT,
    call_start_time TIMESTAMPTZ,
    call_duration_seconds INTEGER,
    campaign_name TEXT,
    disposition TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.id as call_id,
        c.user_id,
        c.transcript_text,
        c.call_start_time,
        c.call_duration_seconds,
        c.campaign_name,
        c.disposition
    FROM calls c
    WHERE c.processing_status = 'queued'
      AND c.transcript_text IS NOT NULL
    ORDER BY c.created_at ASC
    LIMIT batch_size
    FOR UPDATE SKIP LOCKED;
END;
$$;

-- Function to mark a call as processing
CREATE OR REPLACE FUNCTION mark_call_processing(p_call_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE calls
    SET processing_status = 'processing'
    WHERE id = p_call_id;

    RETURN FOUND;
END;
$$;

-- Function to mark a call as completed with audit results
CREATE OR REPLACE FUNCTION complete_call_processing(
    p_call_id UUID,
    p_overall_score NUMERIC,
    p_communication_score NUMERIC DEFAULT NULL,
    p_compliance_score NUMERIC DEFAULT NULL,
    p_accuracy_score NUMERIC DEFAULT NULL,
    p_tone_score NUMERIC DEFAULT NULL,
    p_empathy_score NUMERIC DEFAULT NULL,
    p_resolution_score NUMERIC DEFAULT NULL,
    p_feedback TEXT DEFAULT NULL,
    p_strengths TEXT[] DEFAULT NULL,
    p_areas_for_improvement TEXT[] DEFAULT NULL,
    p_recommendations TEXT[] DEFAULT NULL,
    p_criteria_results JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_report_card_id UUID;
BEGIN
    -- Get user_id from call
    SELECT user_id INTO v_user_id FROM calls WHERE id = p_call_id;

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Call not found: %', p_call_id;
    END IF;

    -- Create report card
    INSERT INTO report_cards (
        user_id,
        call_id,
        source_type,
        overall_score,
        communication_score,
        compliance_score,
        accuracy_score,
        tone_score,
        empathy_score,
        resolution_score,
        feedback,
        strengths,
        areas_for_improvement,
        recommendations,
        criteria_results
    ) VALUES (
        v_user_id,
        p_call_id,
        'call',
        p_overall_score,
        p_communication_score,
        p_compliance_score,
        p_accuracy_score,
        p_tone_score,
        p_empathy_score,
        p_resolution_score,
        p_feedback,
        p_strengths,
        p_areas_for_improvement,
        p_recommendations,
        p_criteria_results
    )
    RETURNING id INTO v_report_card_id;

    -- Update call status
    UPDATE calls
    SET
        status = 'audited',
        processing_status = 'completed',
        audit_id = v_report_card_id,
        updated_at = NOW()
    WHERE id = p_call_id;

    RETURN v_report_card_id;
END;
$$;

-- Function to mark a call as failed
CREATE OR REPLACE FUNCTION fail_call_processing(p_call_id UUID, p_error TEXT DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE calls
    SET
        processing_status = 'failed',
        updated_at = NOW()
    WHERE id = p_call_id;

    -- Log the error (optional - could create an audit_errors table)
    RAISE NOTICE 'Call % processing failed: %', p_call_id, p_error;

    RETURN FOUND;
END;
$$;

-- View for monitoring the processing queue
CREATE OR REPLACE VIEW call_processing_queue AS
SELECT
    processing_status,
    COUNT(*) as count,
    MIN(created_at) as oldest,
    MAX(created_at) as newest
FROM calls
WHERE processing_status IS NOT NULL
GROUP BY processing_status;

-- Function to get processing statistics
CREATE OR REPLACE FUNCTION get_processing_stats()
RETURNS TABLE (
    pending_count BIGINT,
    queued_count BIGINT,
    processing_count BIGINT,
    completed_today BIGINT,
    failed_today BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*) FILTER (WHERE processing_status = 'pending') as pending_count,
        COUNT(*) FILTER (WHERE processing_status = 'queued') as queued_count,
        COUNT(*) FILTER (WHERE processing_status = 'processing') as processing_count,
        COUNT(*) FILTER (WHERE processing_status = 'completed' AND updated_at >= CURRENT_DATE) as completed_today,
        COUNT(*) FILTER (WHERE processing_status = 'failed' AND updated_at >= CURRENT_DATE) as failed_today
    FROM calls;
END;
$$;

-- Trigger to auto-queue calls when transcript is added
CREATE OR REPLACE FUNCTION auto_queue_call_on_transcript()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- If transcript was just added or updated and call is pending
    IF (NEW.transcript_text IS NOT NULL AND NEW.transcript_text != '')
       AND (OLD.transcript_text IS NULL OR OLD.transcript_text = '' OR OLD.transcript_text IS DISTINCT FROM NEW.transcript_text)
       AND (NEW.processing_status IS NULL OR NEW.processing_status = 'pending')
    THEN
        NEW.processing_status := 'queued';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_auto_queue_call ON calls;
CREATE TRIGGER trigger_auto_queue_call
    BEFORE INSERT OR UPDATE ON calls
    FOR EACH ROW
    EXECUTE FUNCTION auto_queue_call_on_transcript();

-- Grant permissions
GRANT EXECUTE ON FUNCTION queue_pending_calls() TO authenticated;
GRANT EXECUTE ON FUNCTION get_calls_to_process(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION mark_call_processing(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION complete_call_processing(UUID, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT[], TEXT[], TEXT[], JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION fail_call_processing(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_processing_stats() TO authenticated;
GRANT SELECT ON call_processing_queue TO authenticated;

-- Enable pg_cron extension (run this manually in Supabase SQL editor if needed)
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule the queue function to run every hour (uncomment after enabling pg_cron)
-- SELECT cron.schedule('queue-pending-calls', '0 * * * *', 'SELECT queue_pending_calls()');
