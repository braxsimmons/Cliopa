import { useEffect, useCallback, useRef } from 'react';
import { RealtimeService } from '@/services/RealtimeService';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

type EventType = 'INSERT' | 'UPDATE' | 'DELETE';

interface RealtimePayload<T> {
  eventType: EventType;
  new: T;
  old: T;
}

/**
 * Hook for subscribing to report card updates in real-time
 */
export function useReportCardsRealtime(
  onUpdate?: (payload: RealtimePayload<any>) => void,
  options?: { showToasts?: boolean; filterByUser?: boolean }
) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { showToasts = true, filterByUser = false } = options || {};

  useEffect(() => {
    if (!user) return;

    const userId = filterByUser ? user.id : null;

    const unsubscribe = RealtimeService.subscribeToReportCards(
      userId,
      (payload) => {
        // Call the custom handler
        onUpdate?.(payload);

        // Show toast notification for new report cards
        if (showToasts && payload.eventType === 'INSERT') {
          toast({
            title: 'New Audit Completed',
            description: `A new report card has been generated with score: ${payload.new.overall_score}%`,
          });
        }
      }
    );

    return () => {
      unsubscribe();
    };
  }, [user, filterByUser, onUpdate, showToasts, toast]);
}

/**
 * Hook for subscribing to call status updates
 */
export function useCallsRealtime(
  onUpdate?: (payload: RealtimePayload<any>) => void,
  options?: { showToasts?: boolean }
) {
  const { toast } = useToast();
  const { showToasts = true } = options || {};

  useEffect(() => {
    const unsubscribe = RealtimeService.subscribeToCallUpdates((payload) => {
      onUpdate?.(payload);

      if (showToasts && payload.eventType === 'UPDATE') {
        const status = payload.new.status;
        if (status === 'audited') {
          toast({
            title: 'Call Audited',
            description: 'A call has been scored by AI',
          });
        } else if (status === 'transcribed') {
          toast({
            title: 'Transcription Complete',
            description: 'A call transcript is now available',
          });
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [onUpdate, showToasts, toast]);
}

/**
 * Hook for subscribing to time entry changes (clock in/out)
 */
export function useTimeEntriesRealtime(
  onUpdate?: (payload: RealtimePayload<any>) => void,
  options?: { filterByUser?: boolean }
) {
  const { user } = useAuth();
  const { filterByUser = true } = options || {};

  useEffect(() => {
    if (!user) return;

    const userId = filterByUser ? user.id : null;

    const unsubscribe = RealtimeService.subscribeToTimeEntries(userId, (payload) => {
      onUpdate?.(payload);
    });

    return () => {
      unsubscribe();
    };
  }, [user, filterByUser, onUpdate]);
}

/**
 * Hook for subscribing to approval updates (time off, corrections)
 */
export function useApprovalsRealtime(
  type: 'time_off' | 'time_corrections',
  onUpdate?: (payload: RealtimePayload<any>) => void,
  options?: { showToasts?: boolean }
) {
  const { toast } = useToast();
  const { showToasts = true } = options || {};

  useEffect(() => {
    const unsubscribe = RealtimeService.subscribeToApprovals(type, (payload) => {
      onUpdate?.(payload);

      if (showToasts && payload.eventType === 'UPDATE') {
        const status = payload.new.status;
        if (status === 'approved') {
          toast({
            title: 'Request Approved',
            description: `Your ${type === 'time_off' ? 'time off' : 'time correction'} request has been approved`,
          });
        } else if (status === 'denied') {
          toast({
            title: 'Request Denied',
            description: `Your ${type === 'time_off' ? 'time off' : 'time correction'} request was not approved`,
            variant: 'destructive',
          });
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [type, onUpdate, showToasts, toast]);
}

/**
 * Hook for tracking team presence (who's online)
 */
export function useTeamPresence() {
  const { user } = useAuth();
  const presenceRef = useRef<Record<string, any[]>>({});

  const getOnlineUsers = useCallback(() => {
    return Object.entries(presenceRef.current).map(([userId, presences]) => ({
      userId,
      ...presences[0],
    }));
  }, []);

  useEffect(() => {
    if (!user) return;

    const unsubscribe = RealtimeService.trackPresence(
      user.id,
      {
        name: user.email || 'Unknown',
        role: 'user',
        status: 'online',
      },
      (state) => {
        presenceRef.current = state;
      }
    );

    return () => {
      unsubscribe();
    };
  }, [user]);

  return { getOnlineUsers };
}

/**
 * Generic hook for any realtime subscription
 */
export function useRealtimeSubscription<T>(
  subscriptionFn: (callback: (payload: RealtimePayload<T>) => void) => () => void,
  onUpdate?: (payload: RealtimePayload<T>) => void,
  deps: any[] = []
) {
  useEffect(() => {
    if (!onUpdate) return;

    const unsubscribe = subscriptionFn(onUpdate);

    return () => {
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscriptionFn, onUpdate, ...deps]);
}

export default {
  useReportCardsRealtime,
  useCallsRealtime,
  useTimeEntriesRealtime,
  useApprovalsRealtime,
  useTeamPresence,
  useRealtimeSubscription,
};
