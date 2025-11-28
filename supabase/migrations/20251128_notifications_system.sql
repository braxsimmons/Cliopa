-- Notifications System Migration
-- Creates a notifications table for in-app notifications

-- Create notification types enum
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

-- Create notifications table
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

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can only see their own notifications
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
CREATE POLICY "Users can view own notifications" ON notifications
    FOR SELECT USING (auth.uid() = user_id);

-- Users can update their own notifications (mark as read)
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
CREATE POLICY "Users can update own notifications" ON notifications
    FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own notifications
DROP POLICY IF EXISTS "Users can delete own notifications" ON notifications;
CREATE POLICY "Users can delete own notifications" ON notifications
    FOR DELETE USING (auth.uid() = user_id);

-- System/admins can insert notifications for any user
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

-- Function to create a notification
CREATE OR REPLACE FUNCTION create_notification(
    p_user_id UUID,
    p_type notification_type,
    p_title TEXT,
    p_message TEXT,
    p_action_url TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_notification_id UUID;
BEGIN
    INSERT INTO notifications (user_id, type, title, message, action_url, metadata)
    VALUES (p_user_id, p_type, p_title, p_message, p_action_url, p_metadata)
    RETURNING id INTO v_notification_id;

    RETURN v_notification_id;
END;
$$;

-- Function to mark notification as read
CREATE OR REPLACE FUNCTION mark_notification_read(p_notification_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE notifications
    SET read = TRUE, updated_at = NOW()
    WHERE id = p_notification_id AND user_id = auth.uid();

    RETURN FOUND;
END;
$$;

-- Function to mark all notifications as read
CREATE OR REPLACE FUNCTION mark_all_notifications_read()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_count INTEGER;
BEGIN
    UPDATE notifications
    SET read = TRUE, updated_at = NOW()
    WHERE user_id = auth.uid() AND read = FALSE;

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

-- Function to get unread notification count
CREATE OR REPLACE FUNCTION get_unread_notification_count()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*)::INTEGER INTO v_count
    FROM notifications
    WHERE user_id = auth.uid() AND read = FALSE;

    RETURN v_count;
END;
$$;

-- Trigger to auto-create notifications on time off request status change
CREATE OR REPLACE FUNCTION notify_time_off_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Only trigger on status change to approved or denied
    IF OLD.status != NEW.status AND NEW.status IN ('approved', 'denied') THEN
        PERFORM create_notification(
            NEW.user_id,
            CASE NEW.status
                WHEN 'approved' THEN 'time_off_approved'::notification_type
                WHEN 'denied' THEN 'time_off_denied'::notification_type
            END,
            CASE NEW.status
                WHEN 'approved' THEN 'Time Off Request Approved'
                WHEN 'denied' THEN 'Time Off Request Denied'
            END,
            CASE NEW.status
                WHEN 'approved' THEN 'Your time off request for ' || TO_CHAR(NEW.request_date, 'Mon DD, YYYY') || ' has been approved.'
                WHEN 'denied' THEN 'Your time off request for ' || TO_CHAR(NEW.request_date, 'Mon DD, YYYY') || ' has been denied.'
            END,
            '/dashboard',
            jsonb_build_object('request_id', NEW.id, 'request_date', NEW.request_date)
        );
    END IF;

    RETURN NEW;
END;
$$;

-- Create trigger for time off notifications
DROP TRIGGER IF EXISTS trigger_notify_time_off_status ON time_off_requests;
CREATE TRIGGER trigger_notify_time_off_status
    AFTER UPDATE ON time_off_requests
    FOR EACH ROW
    EXECUTE FUNCTION notify_time_off_status_change();

-- Trigger to auto-create notifications on time correction status change
CREATE OR REPLACE FUNCTION notify_time_correction_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Only trigger on status change to approved or denied
    IF OLD.status != NEW.status AND NEW.status IN ('approved', 'denied') THEN
        PERFORM create_notification(
            NEW.user_id,
            CASE NEW.status
                WHEN 'approved' THEN 'time_correction_approved'::notification_type
                WHEN 'denied' THEN 'time_correction_denied'::notification_type
            END,
            CASE NEW.status
                WHEN 'approved' THEN 'Time Correction Approved'
                WHEN 'denied' THEN 'Time Correction Denied'
            END,
            CASE NEW.status
                WHEN 'approved' THEN 'Your time correction request has been approved.'
                WHEN 'denied' THEN 'Your time correction request has been denied.'
            END,
            '/dashboard',
            jsonb_build_object('correction_id', NEW.id)
        );
    END IF;

    RETURN NEW;
END;
$$;

-- Create trigger for time correction notifications
DROP TRIGGER IF EXISTS trigger_notify_time_correction_status ON time_corrections;
CREATE TRIGGER trigger_notify_time_correction_status
    AFTER UPDATE ON time_corrections
    FOR EACH ROW
    EXECUTE FUNCTION notify_time_correction_status_change();

-- Grant permissions
GRANT USAGE ON TYPE notification_type TO authenticated;
GRANT SELECT, UPDATE, DELETE ON notifications TO authenticated;
GRANT EXECUTE ON FUNCTION create_notification TO authenticated;
GRANT EXECUTE ON FUNCTION mark_notification_read TO authenticated;
GRANT EXECUTE ON FUNCTION mark_all_notifications_read TO authenticated;
GRANT EXECUTE ON FUNCTION get_unread_notification_count TO authenticated;
