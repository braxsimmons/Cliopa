import { supabase } from '@/integrations/supabase/client';

export interface Announcement {
  id: string;
  title: string;
  content: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  target_audience: 'all' | 'managers' | 'employees';
  target_team: string | null;
  is_active: boolean;
  starts_at: string | null;
  expires_at: string | null;
  created_by: string | null;
  created_at: string;
  creator_name?: string;
}

export interface CreateAnnouncementInput {
  title: string;
  content: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  target_audience?: 'all' | 'managers' | 'employees';
  target_team?: string;
  starts_at?: string;
  expires_at?: string;
}

export const AnnouncementsService = {
  // Get active announcements for current user
  async getActiveAnnouncements(): Promise<Announcement[]> {
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('announcements')
      .select(`
        *,
        profiles:created_by (
          first_name,
          last_name
        )
      `)
      .eq('is_active', true)
      .or(`starts_at.is.null,starts_at.lte.${now}`)
      .or(`expires_at.is.null,expires_at.gt.${now}`)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching announcements:', error);
      throw error;
    }

    return (data || []).map((a: any) => ({
      ...a,
      creator_name: a.profiles
        ? `${a.profiles.first_name || ''} ${a.profiles.last_name || ''}`.trim()
        : null,
    }));
  },

  // Get all announcements (for admin)
  async getAllAnnouncements(): Promise<Announcement[]> {
    const { data, error } = await supabase
      .from('announcements')
      .select(`
        *,
        profiles:created_by (
          first_name,
          last_name
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching all announcements:', error);
      throw error;
    }

    return (data || []).map((a: any) => ({
      ...a,
      creator_name: a.profiles
        ? `${a.profiles.first_name || ''} ${a.profiles.last_name || ''}`.trim()
        : null,
    }));
  },

  // Create announcement
  async createAnnouncement(input: CreateAnnouncementInput): Promise<Announcement> {
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('announcements')
      .insert({
        ...input,
        created_by: user?.id,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating announcement:', error);
      throw error;
    }

    return data;
  },

  // Update announcement
  async updateAnnouncement(id: string, updates: Partial<CreateAnnouncementInput & { is_active: boolean }>): Promise<void> {
    const { error } = await supabase
      .from('announcements')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      console.error('Error updating announcement:', error);
      throw error;
    }
  },

  // Delete announcement
  async deleteAnnouncement(id: string): Promise<void> {
    const { error } = await supabase
      .from('announcements')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting announcement:', error);
      throw error;
    }
  },
};
