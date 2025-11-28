import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

export type RealtimeEventType = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

interface SubscriptionConfig {
  table: string;
  event?: RealtimeEventType;
  filter?: string;
  schema?: string;
}

// Centralized real-time subscription manager
class RealtimeManager {
  private channels: Map<string, RealtimeChannel> = new Map();
  private listeners: Map<string, Set<(payload: any) => void>> = new Map();

  /**
   * Subscribe to database changes
   */
  subscribe<T>(
    channelName: string,
    config: SubscriptionConfig,
    callback: (payload: { eventType: string; new: T; old: T }) => void
  ): () => void {
    const { table, event = '*', filter, schema = 'public' } = config;

    // Add callback to listeners
    if (!this.listeners.has(channelName)) {
      this.listeners.set(channelName, new Set());
    }
    this.listeners.get(channelName)!.add(callback);

    // Create channel if it doesn't exist
    if (!this.channels.has(channelName)) {
      const channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event,
            schema,
            table,
            filter,
          },
          (payload) => {
            const formattedPayload = {
              eventType: payload.eventType,
              new: payload.new as T,
              old: payload.old as T,
            };
            this.listeners.get(channelName)?.forEach((cb) => cb(formattedPayload));
          }
        )
        .subscribe();

      this.channels.set(channelName, channel);
    }

    // Return unsubscribe function
    return () => {
      const listeners = this.listeners.get(channelName);
      if (listeners) {
        listeners.delete(callback);
        // If no more listeners, remove channel
        if (listeners.size === 0) {
          const channel = this.channels.get(channelName);
          if (channel) {
            supabase.removeChannel(channel);
            this.channels.delete(channelName);
            this.listeners.delete(channelName);
          }
        }
      }
    };
  }

  /**
   * Broadcast a custom event to all subscribers
   */
  broadcast(channelName: string, event: string, payload: any): void {
    const channel = this.channels.get(channelName);
    if (channel) {
      channel.send({
        type: 'broadcast',
        event,
        payload,
      });
    }
  }

  /**
   * Subscribe to presence (who's online)
   */
  subscribeToPresence(
    channelName: string,
    userId: string,
    userInfo: Record<string, any>,
    onSync: (state: Record<string, any[]>) => void,
    onJoin?: (key: string, currentPresences: any, newPresences: any) => void,
    onLeave?: (key: string, currentPresences: any, leftPresences: any) => void
  ): () => void {
    const channel = supabase.channel(channelName, {
      config: {
        presence: {
          key: userId,
        },
      },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        onSync(state);
      })
      .on('presence', { event: 'join' }, ({ key, currentPresences, newPresences }) => {
        onJoin?.(key, currentPresences, newPresences);
      })
      .on('presence', { event: 'leave' }, ({ key, currentPresences, leftPresences }) => {
        onLeave?.(key, currentPresences, leftPresences);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track(userInfo);
        }
      });

    this.channels.set(channelName, channel);

    return () => {
      supabase.removeChannel(channel);
      this.channels.delete(channelName);
    };
  }

  /**
   * Unsubscribe from all channels
   */
  unsubscribeAll(): void {
    this.channels.forEach((channel) => {
      supabase.removeChannel(channel);
    });
    this.channels.clear();
    this.listeners.clear();
  }
}

export const realtimeManager = new RealtimeManager();

// Convenience functions for common subscriptions
export const RealtimeService = {
  /**
   * Subscribe to report card updates for a user or all users (managers)
   */
  subscribeToReportCards(
    userId: string | null,
    callback: (payload: { eventType: string; new: any; old: any }) => void
  ) {
    const filter = userId ? `user_id=eq.${userId}` : undefined;
    return realtimeManager.subscribe(
      `report_cards:${userId || 'all'}`,
      { table: 'report_cards', filter },
      callback
    );
  },

  /**
   * Subscribe to call status updates
   */
  subscribeToCallUpdates(
    callback: (payload: { eventType: string; new: any; old: any }) => void
  ) {
    return realtimeManager.subscribe('calls:updates', { table: 'calls' }, callback);
  },

  /**
   * Subscribe to time entry updates for live clocked-in status
   */
  subscribeToTimeEntries(
    userId: string | null,
    callback: (payload: { eventType: string; new: any; old: any }) => void
  ) {
    const filter = userId ? `user_id=eq.${userId}` : undefined;
    return realtimeManager.subscribe(
      `time_entries:${userId || 'all'}`,
      { table: 'time_entries', filter },
      callback
    );
  },

  /**
   * Subscribe to approval status changes
   */
  subscribeToApprovals(
    type: 'time_off' | 'time_corrections',
    callback: (payload: { eventType: string; new: any; old: any }) => void
  ) {
    const table = type === 'time_off' ? 'time_off_requests' : 'time_corrections';
    return realtimeManager.subscribe(`approvals:${type}`, { table }, callback);
  },

  /**
   * Subscribe to announcements
   */
  subscribeToAnnouncements(
    callback: (payload: { eventType: string; new: any; old: any }) => void
  ) {
    return realtimeManager.subscribe('announcements', { table: 'announcements' }, callback);
  },

  /**
   * Subscribe to coaching sessions
   */
  subscribeToCoachingSessions(
    userId: string,
    callback: (payload: { eventType: string; new: any; old: any }) => void
  ) {
    return realtimeManager.subscribe(
      `coaching:${userId}`,
      { table: 'coaching_sessions', filter: `agent_id=eq.${userId}` },
      callback
    );
  },

  /**
   * Subscribe to alerts
   */
  subscribeToAlerts(
    userId: string,
    callback: (payload: { eventType: string; new: any; old: any }) => void
  ) {
    return realtimeManager.subscribe(
      `alerts:${userId}`,
      { table: 'alerts', filter: `user_id=eq.${userId}` },
      callback
    );
  },

  /**
   * Track online presence for team dashboard
   */
  trackPresence(
    userId: string,
    userInfo: { name: string; role: string; team?: string; status?: string },
    onSync: (state: Record<string, any[]>) => void
  ) {
    return realtimeManager.subscribeToPresence(
      'team:presence',
      userId,
      { ...userInfo, online_at: new Date().toISOString() },
      onSync
    );
  },
};
