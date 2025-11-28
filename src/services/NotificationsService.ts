import { supabase } from '@/integrations/supabase/client';

export type NotificationType =
  | 'time_off_approved'
  | 'time_off_denied'
  | 'time_correction_approved'
  | 'time_correction_denied'
  | 'shift_reminder'
  | 'audit_completed'
  | 'report_card_available'
  | 'system_announcement'
  | 'shift_needs_approval';

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  action_url: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface NotificationInsert {
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  action_url?: string;
  metadata?: Record<string, unknown>;
}

// Get all notifications for current user
export async function getNotifications(limit: number = 50): Promise<{
  notifications: Notification[];
  error: Error | null;
}> {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return { notifications: (data as Notification[]) || [], error: null };
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return { notifications: [], error: error as Error };
  }
}

// Get unread notifications
export async function getUnreadNotifications(): Promise<{
  notifications: Notification[];
  error: Error | null;
}> {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('read', false)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return { notifications: (data as Notification[]) || [], error: null };
  } catch (error) {
    console.error('Error fetching unread notifications:', error);
    return { notifications: [], error: error as Error };
  }
}

// Get unread notification count
export async function getUnreadCount(): Promise<{
  count: number;
  error: Error | null;
}> {
  try {
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('read', false);

    if (error) throw error;

    return { count: count || 0, error: null };
  } catch (error) {
    console.error('Error fetching unread count:', error);
    return { count: 0, error: error as Error };
  }
}

// Mark a notification as read
export async function markAsRead(notificationId: string): Promise<{
  success: boolean;
  error: Error | null;
}> {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true, updated_at: new Date().toISOString() })
      .eq('id', notificationId);

    if (error) throw error;

    return { success: true, error: null };
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return { success: false, error: error as Error };
  }
}

// Mark all notifications as read
export async function markAllAsRead(): Promise<{
  count: number;
  error: Error | null;
}> {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .update({ read: true, updated_at: new Date().toISOString() })
      .eq('read', false)
      .select();

    if (error) throw error;

    return { count: data?.length || 0, error: null };
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    return { count: 0, error: error as Error };
  }
}

// Delete a notification
export async function deleteNotification(notificationId: string): Promise<{
  success: boolean;
  error: Error | null;
}> {
  try {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId);

    if (error) throw error;

    return { success: true, error: null };
  } catch (error) {
    console.error('Error deleting notification:', error);
    return { success: false, error: error as Error };
  }
}

// Delete all read notifications
export async function deleteAllRead(): Promise<{
  count: number;
  error: Error | null;
}> {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .delete()
      .eq('read', true)
      .select();

    if (error) throw error;

    return { count: data?.length || 0, error: null };
  } catch (error) {
    console.error('Error deleting read notifications:', error);
    return { count: 0, error: error as Error };
  }
}

// Create a notification (for admin/manager use)
export async function createNotification(notification: NotificationInsert): Promise<{
  notification: Notification | null;
  error: Error | null;
}> {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .insert({
        user_id: notification.user_id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        action_url: notification.action_url || null,
        metadata: notification.metadata || {},
      })
      .select()
      .single();

    if (error) throw error;

    return { notification: data as Notification, error: null };
  } catch (error) {
    console.error('Error creating notification:', error);
    return { notification: null, error: error as Error };
  }
}

// Subscribe to real-time notifications
export function subscribeToNotifications(
  userId: string,
  onNotification: (notification: Notification) => void
) {
  const channel = supabase
    .channel(`notifications:${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        onNotification(payload.new as Notification);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
