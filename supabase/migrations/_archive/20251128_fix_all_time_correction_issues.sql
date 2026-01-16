-- Complete fix for time correction functions
-- This migration fixes all issues with approve/deny time correction

-- First, drop any problematic triggers that might be causing issues
DROP TRIGGER IF EXISTS trigger_notify_time_correction_status ON time_corrections;
DROP FUNCTION IF EXISTS notify_time_correction_status_change();

-- Create the notification_type if it doesn't exist
DO $$ BEGIN
    CREATE TYPE notification_type AS ENUM (
        'time_off_approved',
        'time_off_denied',
        'time_correction_approved',
        'time_correction_denied',
        'shift_reminder',
        'audit_completed',
        'report_card_available',
        'system_announcement',
        'shift_needs_approval'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create notifications table if it doesn't exist
CREATE TABLE IF NOT EXISTS notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    type notification_type NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    read BOOLEAN DEFAULT FALSE,
    action_url TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies (drop first to avoid conflicts)
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
CREATE POLICY "Users can view own notifications" ON notifications
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
CREATE POLICY "Users can update own notifications" ON notifications
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own notifications" ON notifications;
CREATE POLICY "Users can delete own notifications" ON notifications
    FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can insert notifications" ON notifications;
CREATE POLICY "Admins can insert notifications" ON notifications
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'manager')
        )
        OR auth.uid() = user_id
    );

-- Recreate the deny_time_correction function with proper implementation
CREATE OR REPLACE FUNCTION public.deny_time_correction(correction_id uuid, notes text DEFAULT NULL::text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
    correction_record RECORD;
BEGIN
    -- Get the correction details
    SELECT *
    INTO correction_record
    FROM public.time_corrections
    WHERE
        id = correction_id
        AND status = 'pending';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Correction not found or already processed';
    END IF;

    -- Update the correction status
    UPDATE public.time_corrections
    SET
        status = 'denied',
        review_notes = notes,
        updated_at = NOW()
    WHERE
        id = correction_id;

    RETURN TRUE;
END;
$function$;

-- Recreate the approve_time_correction function with correct column names
CREATE OR REPLACE FUNCTION public.approve_time_correction(
    correction_id uuid,
    approver_id uuid,
    notes text DEFAULT NULL::text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
    correction_record RECORD;
BEGIN
    -- Get the correction details
    SELECT *
    INTO correction_record
    FROM public.time_corrections
    WHERE
        id = correction_id
        AND status = 'pending';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Correction not found or already processed';
    END IF;

    -- Update the time entry with corrected values (using correct column names: start_time, end_time)
    UPDATE public.time_entries
    SET
        start_time = COALESCE(correction_record.requested_start_time, start_time),
        end_time = COALESCE(correction_record.requested_end_time, end_time),
        shift_type = COALESCE(correction_record.shift_type, shift_type),
        total_hours = EXTRACT(EPOCH FROM (
            COALESCE(correction_record.requested_end_time, end_time) -
            COALESCE(correction_record.requested_start_time, start_time)
        )) / 3600,
        updated_at = NOW()
    WHERE
        id = correction_record.time_entry_id;

    -- Update the correction status
    UPDATE public.time_corrections
    SET
        status = 'approved',
        approved_by = approver_id,
        approved_at = NOW(),
        review_notes = notes,
        updated_at = NOW()
    WHERE
        id = correction_id;

    RETURN TRUE;
END;
$function$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.deny_time_correction(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.deny_time_correction(uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION public.deny_time_correction(uuid, text) TO service_role;

GRANT EXECUTE ON FUNCTION public.approve_time_correction(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_time_correction(uuid, uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION public.approve_time_correction(uuid, uuid, text) TO service_role;

-- Grant on notifications
GRANT USAGE ON TYPE notification_type TO authenticated;
GRANT SELECT, UPDATE, DELETE ON notifications TO authenticated;
GRANT INSERT ON notifications TO authenticated;
