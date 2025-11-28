import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import {
  Megaphone,
  X,
  AlertTriangle,
  Info,
  Bell,
  ChevronRight,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AnnouncementsService, Announcement } from '@/services/AnnouncementsService';
import { cn } from '@/lib/utils';

const PRIORITY_CONFIG = {
  urgent: {
    icon: AlertTriangle,
    bg: 'bg-red-500/10 border-red-500',
    text: 'text-red-600',
    badge: 'bg-red-500',
  },
  high: {
    icon: Bell,
    bg: 'bg-orange-500/10 border-orange-500',
    text: 'text-orange-600',
    badge: 'bg-orange-500',
  },
  normal: {
    icon: Megaphone,
    bg: 'bg-blue-500/10 border-blue-500',
    text: 'text-blue-600',
    badge: 'bg-blue-500',
  },
  low: {
    icon: Info,
    bg: 'bg-[var(--color-bg)] border-[var(--color-border)]',
    text: 'text-[var(--color-text)]',
    badge: 'bg-[var(--color-subtext)]',
  },
};

export const AnnouncementsBanner = () => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    fetchAnnouncements();

    // Load dismissed announcements from localStorage
    const dismissed = localStorage.getItem('dismissed_announcements');
    if (dismissed) {
      setDismissedIds(new Set(JSON.parse(dismissed)));
    }
  }, []);

  const fetchAnnouncements = async () => {
    try {
      const data = await AnnouncementsService.getActiveAnnouncements();
      setAnnouncements(data);
    } catch (error) {
      console.error('Error fetching announcements:', error);
    }
  };

  const dismissAnnouncement = (id: string) => {
    const newDismissed = new Set(dismissedIds).add(id);
    setDismissedIds(newDismissed);
    localStorage.setItem('dismissed_announcements', JSON.stringify([...newDismissed]));
  };

  const visibleAnnouncements = announcements.filter(a => !dismissedIds.has(a.id));

  if (visibleAnnouncements.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3 mb-6">
      {visibleAnnouncements.map((announcement) => {
        const config = PRIORITY_CONFIG[announcement.priority];
        const Icon = config.icon;
        const isExpanded = expanded === announcement.id;

        return (
          <Card
            key={announcement.id}
            className={cn(
              'border transition-all',
              config.bg
            )}
          >
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className={cn('p-2 rounded-lg', config.bg)}>
                  <Icon className={cn('h-5 w-5', config.text)} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className={cn('font-semibold', config.text)}>
                      {announcement.title}
                    </h3>
                    {announcement.priority !== 'normal' && (
                      <Badge className={cn('text-white text-xs', config.badge)}>
                        {announcement.priority}
                      </Badge>
                    )}
                  </div>
                  <p className={cn(
                    'text-sm',
                    isExpanded ? '' : 'line-clamp-2',
                    config.text
                  )}>
                    {announcement.content}
                  </p>
                  {announcement.content.length > 150 && (
                    <button
                      onClick={() => setExpanded(isExpanded ? null : announcement.id)}
                      className={cn('text-xs font-medium mt-1 flex items-center gap-1', config.text)}
                    >
                      {isExpanded ? 'Show less' : 'Read more'}
                      <ChevronRight className={cn('h-3 w-3 transition-transform', isExpanded && 'rotate-90')} />
                    </button>
                  )}
                  <p className="text-xs text-[var(--color-subtext)] mt-2">
                    {announcement.creator_name && `Posted by ${announcement.creator_name} • `}
                    {format(new Date(announcement.created_at), 'MMM d, yyyy')}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => dismissAnnouncement(announcement.id)}
                  className="h-8 w-8 text-[var(--color-subtext)] hover:text-[var(--color-text)]"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
