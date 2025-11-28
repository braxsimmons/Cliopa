import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, CheckCheck, Trash2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useNotifications } from '@/hooks/useNotifications';
import { Notification } from '@/services/NotificationsService';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

const getNotificationIcon = (type: Notification['type']) => {
  switch (type) {
    case 'time_off_approved':
      return '✅';
    case 'time_off_denied':
      return '❌';
    case 'time_correction_approved':
      return '✅';
    case 'time_correction_denied':
      return '❌';
    case 'shift_reminder':
      return '⏰';
    case 'audit_completed':
      return '📊';
    case 'report_card_available':
      return '📋';
    case 'system_announcement':
      return '📢';
    case 'shift_needs_approval':
      return '⚠️';
    default:
      return '📬';
  }
};

const NotificationItem: React.FC<{
  notification: Notification;
  onMarkRead: (id: string) => void;
  onDelete: (id: string) => void;
  onNavigate: (url: string) => void;
}> = ({ notification, onMarkRead, onDelete, onNavigate }) => {
  const timeAgo = formatDistanceToNow(new Date(notification.created_at), {
    addSuffix: true,
  });

  return (
    <div
      className={cn(
        'p-3 border-b border-[var(--color-border)] last:border-0 transition-colors',
        !notification.read && 'bg-blue-50/50 dark:bg-blue-950/20'
      )}
    >
      <div className="flex items-start gap-3">
        <span className="text-lg flex-shrink-0">
          {getNotificationIcon(notification.type)}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p
              className={cn(
                'text-sm truncate',
                !notification.read
                  ? 'font-semibold text-[var(--color-text)]'
                  : 'font-medium text-[var(--color-subtext)]'
              )}
            >
              {notification.title}
            </p>
            {!notification.read && (
              <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
            )}
          </div>
          <p className="text-xs text-[var(--color-subtext)] mt-0.5 line-clamp-2">
            {notification.message}
          </p>
          <p className="text-xs text-[var(--color-subtext)] mt-1 opacity-70">
            {timeAgo}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1 mt-2 ml-8">
        {!notification.read && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => onMarkRead(notification.id)}
          >
            <Check className="h-3 w-3 mr-1" />
            Mark read
          </Button>
        )}
        {notification.action_url && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => {
              onMarkRead(notification.id);
              onNavigate(notification.action_url!);
            }}
          >
            <ExternalLink className="h-3 w-3 mr-1" />
            View
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 ml-auto"
          onClick={() => onDelete(notification.id)}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
};

export const NotificationsDropdown: React.FC = () => {
  const navigate = useNavigate();
  const {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useNotifications();

  const handleNavigate = (url: string) => {
    navigate(url);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative text-[var(--color-text)] hover:bg-[var(--color-border)]"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 min-w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
          <span className="sr-only">Notifications</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-80 p-0 bg-[var(--color-surface)] border-[var(--color-border)]"
        align="end"
      >
        <div className="flex items-center justify-between p-3 border-b border-[var(--color-border)]">
          <h3 className="font-semibold text-[var(--color-text)]">
            Notifications
          </h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={markAllAsRead}
            >
              <CheckCheck className="h-3 w-3 mr-1" />
              Mark all read
            </Button>
          )}
        </div>

        <ScrollArea className="h-[400px]">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin h-6 w-6 border-2 border-[var(--color-accent)] border-t-transparent rounded-full" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-[var(--color-subtext)]">
              <Bell className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">No notifications yet</p>
            </div>
          ) : (
            notifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onMarkRead={markAsRead}
                onDelete={deleteNotification}
                onNavigate={handleNavigate}
              />
            ))
          )}
        </ScrollArea>

        {notifications.length > 0 && (
          <>
            <Separator className="bg-[var(--color-border)]" />
            <div className="p-2">
              <p className="text-xs text-center text-[var(--color-subtext)]">
                {notifications.length} notification{notifications.length !== 1 ? 's' : ''}
                {unreadCount > 0 && ` (${unreadCount} unread)`}
              </p>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
};
