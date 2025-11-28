import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import {
  Notification,
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  subscribeToNotifications,
} from '@/services/NotificationsService';
import { toast } from '@/components/ui/use-toast';

export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      const [notifResult, countResult] = await Promise.all([
        getNotifications(50),
        getUnreadCount(),
      ]);

      if (notifResult.error) throw notifResult.error;
      if (countResult.error) throw countResult.error;

      setNotifications(notifResult.notifications);
      setUnreadCount(countResult.count);
      setError(null);
    } catch (err) {
      setError(err as Error);
      console.error('Error fetching notifications:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // Mark single notification as read
  const handleMarkAsRead = useCallback(async (notificationId: string) => {
    const result = await markAsRead(notificationId);
    if (result.success) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }
    return result;
  }, []);

  // Mark all as read
  const handleMarkAllAsRead = useCallback(async () => {
    const result = await markAllAsRead();
    if (!result.error) {
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
      toast({
        title: 'All notifications marked as read',
        description: `${result.count} notifications updated`,
      });
    }
    return result;
  }, []);

  // Delete notification
  const handleDelete = useCallback(async (notificationId: string) => {
    const notification = notifications.find((n) => n.id === notificationId);
    const result = await deleteNotification(notificationId);
    if (result.success) {
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
      if (notification && !notification.read) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    }
    return result;
  }, [notifications]);

  // Handle new notification from realtime subscription
  const handleNewNotification = useCallback((notification: Notification) => {
    setNotifications((prev) => [notification, ...prev]);
    setUnreadCount((prev) => prev + 1);

    // Show toast for new notification
    toast({
      title: notification.title,
      description: notification.message,
    });
  }, []);

  // Initial fetch and subscription
  useEffect(() => {
    if (!user?.id) {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    fetchNotifications();

    // Subscribe to real-time notifications
    const unsubscribe = subscribeToNotifications(user.id, handleNewNotification);

    return () => {
      unsubscribe();
    };
  }, [user?.id, fetchNotifications, handleNewNotification]);

  return {
    notifications,
    unreadCount,
    loading,
    error,
    refetch: fetchNotifications,
    markAsRead: handleMarkAsRead,
    markAllAsRead: handleMarkAllAsRead,
    deleteNotification: handleDelete,
  };
}
