-- Add 'performance_alert' to notification_type enum
-- This is needed for the coaching/alerts system to create notifications

ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'performance_alert';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'coaching_session';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'goal_update';
